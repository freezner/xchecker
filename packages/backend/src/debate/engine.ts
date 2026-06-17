import { FacilitatorRole } from './facilitator';
import { DebaterRole } from './debater';
import { IsolatedContext } from './context';
import { HarnessConfig, checkHarness } from './harness';
import { DebateDocument } from './document';

export type DebateEventType =
  | 'policy'
  | 'round_start'
  | 'chunk'        // 스트리밍 청크
  | 'message'      // 완성된 메시지
  | 'synthesis'
  | 'harness_update'
  | 'harness_stop'
  | 'consensus'
  | 'conclusion'
  | 'done'
  | 'error';

export interface DebateEvent {
  type: DebateEventType;
  role?: 'facilitator' | 'debater_a' | 'debater_b';
  round?: number;
  content?: string;
  tokenTotal?: number;
  reason?: string;
}

export class DebateEngine {
  private tokenTotal = 0;
  private startedAt = new Date();

  constructor(
    private topic: string,
    private description: string,
    private harness: HarnessConfig,
    private facilitator: FacilitatorRole,
    private debaterA: DebaterRole,
    private debaterB: DebaterRole,
    private context: IsolatedContext,
    private emit: (event: DebateEvent) => void,
    private documents: DebateDocument[] = [],
  ) {}

  async run() {
    // 이미지 문서를 컨텍스트에 프리시드
    const imageDocs = this.documents.filter((d) => d.mime_type.startsWith('image/'));
    this.context.preSeedImages(imageDocs);
    try {
      // 1. Facilitator가 토론 정책 수립
      const policy = await this.facilitator.createPolicy(this.topic, this.description);
      this.emit({ type: 'policy', content: JSON.stringify(policy) });

      // 2. 라운드 진행
      let previousAnswerB = '';
      for (let round = 1; round <= policy.rounds; round++) {
        // 하네스 체크
        const harnessResult = checkHarness(this.harness, round, this.tokenTotal, this.startedAt);
        if (harnessResult.shouldStop) {
          this.emit({ type: 'harness_stop', reason: harnessResult.reason, round });
          break;
        }

        this.emit({ type: 'round_start', round });

        // Facilitator 질문 생성 (스트리밍)
        this.emit({ type: 'chunk', role: 'facilitator', round, content: '' });
        const question = await this.facilitator.generateQuestion(round, policy);
        this.emit({ type: 'message', role: 'facilitator', round, content: question.content });
        this.tokenTotal += question.tokenCount;

        // 토론자A 응답 (격리된 컨텍스트, 스트리밍)
        this.emit({ type: 'chunk', role: 'debater_a', round, content: '' });
        const answerA = await this.debaterA.respond(question.content, previousAnswerB);
        this.emit({ type: 'message', role: 'debater_a', round, content: answerA.content });
        this.tokenTotal += answerA.tokenCount;

        // 토론자B 응답 (격리된 컨텍스트, 스트리밍)
        this.emit({ type: 'chunk', role: 'debater_b', round, content: '' });
        const answerB = await this.debaterB.respond(question.content, answerA.content);
        this.emit({ type: 'message', role: 'debater_b', round, content: answerB.content });
        this.tokenTotal += answerB.tokenCount;
        previousAnswerB = answerB.content;

        // Facilitator 합산
        const synthesis = await this.facilitator.synthesize(
          question.content,
          answerA.content,
          answerB.content,
        );
        this.emit({ type: 'synthesis', round, content: synthesis.content });
        this.tokenTotal += synthesis.tokenCount;

        this.emit({ type: 'harness_update', round, tokenTotal: this.tokenTotal });

        // 합의 도달 시 조기 종료
        if (this.harness.stopOnConsensus && synthesis.consensusReached) {
          this.emit({ type: 'consensus', round });
          break;
        }
      }

      // 3. 최종 결론 (스트리밍)
      this.emit({ type: 'chunk', role: 'facilitator', content: '' });
      const conclusion = await this.facilitator.conclude();
      this.emit({ type: 'conclusion', content: conclusion.content });
      this.tokenTotal += conclusion.tokenCount;

      this.emit({ type: 'done', tokenTotal: this.tokenTotal });
    } catch (err) {
      this.emit({ type: 'error', content: (err as Error).message });
    }
  }
}
