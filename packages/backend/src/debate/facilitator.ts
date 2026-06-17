import { LLMProvider, LLMMessage } from '../llm/provider';
import { IsolatedContext } from './context';
import { HarnessConfig } from './harness';
import { DebateDocument } from './document';

export interface DebatePolicy {
  rounds: number;
  focusAreas: string[];
}

export interface SynthesisResult {
  content: string;
  consensusReached: boolean;
  tokenCount: number;
}

const FACILITATOR_SYSTEM = `당신은 공정한 토론 진행자입니다.
두 독립적인 분석가(토론자A, 토론자B)가 주어진 주제에 대해 각자의 의견을 제시합니다.
당신의 역할:
1. 토론 정책 수립: 핵심 쟁점 도출, 질문 설계
2. 각 라운드에서 날카로운 질문 제시
3. 양측 답변을 합산하고 합의 또는 차이점을 정리
4. 최종 결론 도출

출처 표기 지침:
- 특정 사실, 통계, 주장을 언급할 때는 가능한 경우 출처를 명시하세요.
- 참고 자료로 제공된 문서나 URL이 있다면 해당 내용을 인용할 때 출처를 함께 표기하세요.
- 외부 기사나 연구를 인용할 경우 "[출처: 제목 또는 URL]" 형식으로 표기하세요.
- 출처를 확인할 수 없는 내용은 추측임을 명시하고 출처 표기를 생략하세요.

응답은 항상 한국어로 하세요.`;

export class FacilitatorRole {
  private systemPrompt: string;

  constructor(
    private provider: LLMProvider,
    private context: IsolatedContext,
    private harness: HarnessConfig,
    private onChunk: (chunk: string) => void,
    documents: DebateDocument[] = [],
    debateRules = '',
  ) {
    const ruleNote = debateRules.trim() ? `\n\n[토론 규칙]\n${debateRules.trim()}` : '';
    const textDocs = documents.filter((d) => !d.mime_type.startsWith('image/'));
    const docNote = textDocs.length > 0
      ? '\n\n[참고 자료]\n' + textDocs.map((d) => `--- ${d.filename} ---\n${d.content}`).join('\n\n')
      : '';
    this.systemPrompt = FACILITATOR_SYSTEM + ruleNote + docNote;
  }

  async createPolicy(topic: string, description = ''): Promise<DebatePolicy> {
    const descBlock = description.trim()
      ? `\n\n배경 설명:\n${description.trim()}`
      : '';
    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `주제: "${topic}"${descBlock}

이 주제를 검증하기 위한 토론 정책을 수립하세요.
최대 ${this.harness.maxRounds}라운드 내에서 핵심 쟁점을 다룰 수 있도록 설계하세요.
응답 형식(JSON):
{
  "rounds": <실제 필요한 라운드 수, 최대 ${this.harness.maxRounds}>,
  "focusAreas": ["쟁점1", "쟁점2", ...]
}`,
      },
    ];

    const res = await this.provider.chat(messages, 500);
    this.context.addFacilitator({ role: 'user', content: messages[1].content });
    this.context.addFacilitator({ role: 'assistant', content: res.content });

    try {
      const parsed = JSON.parse(res.content.replace(/```json\n?|```/g, '').trim()) as DebatePolicy;
      return {
        rounds: Math.min(parsed.rounds, this.harness.maxRounds),
        focusAreas: parsed.focusAreas,
      };
    } catch {
      return { rounds: this.harness.maxRounds, focusAreas: [topic] };
    }
  }

  async generateQuestion(round: number, policy: DebatePolicy): Promise<{ content: string; tokenCount: number }> {
    const focusArea = policy.focusAreas[(round - 1) % policy.focusAreas.length];
    const prompt = `[라운드 ${round}] 쟁점: "${focusArea}"
두 분석가에게 던질 핵심 질문 하나를 작성하세요. 질문만 작성하세요.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.context.getFacilitatorHistory(),
      { role: 'user', content: prompt },
    ];

    let content = '';
    const res = await this.provider.chatStream(messages, this.harness.maxTokensPerTurn, (chunk) => {
      content += chunk;
      this.onChunk(chunk);
    });

    this.context.addFacilitator({ role: 'user', content: prompt });
    this.context.addFacilitator({ role: 'assistant', content: res.content });

    return { content: res.content, tokenCount: res.tokenCount };
  }

  async synthesize(
    question: string,
    answerA: string,
    answerB: string,
  ): Promise<SynthesisResult> {
    const prompt = `질문: ${question}

토론자A 답변: ${answerA}

토론자B 답변: ${answerB}

양측의 공통점과 차이점을 정리하고, 합의에 도달했는지 판단하세요.
응답 형식(JSON):
{
  "summary": "합산 내용",
  "consensusReached": true 또는 false
}`;

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.context.getFacilitatorHistory(),
      { role: 'user', content: prompt },
    ];

    const res = await this.provider.chat(messages, this.harness.maxTokensPerTurn);
    this.context.addFacilitator({ role: 'user', content: prompt });
    this.context.addFacilitator({ role: 'assistant', content: res.content });

    try {
      const parsed = JSON.parse(res.content.replace(/```json\n?|```/g, '').trim()) as {
        summary: string;
        consensusReached: boolean;
      };
      return { content: parsed.summary, consensusReached: parsed.consensusReached, tokenCount: res.tokenCount };
    } catch {
      return { content: res.content, consensusReached: false, tokenCount: res.tokenCount };
    }
  }

  async conclude(): Promise<{ content: string; tokenCount: number }> {
    const prompt = `지금까지의 토론을 바탕으로 최종 결론을 작성하세요.
주제에 대한 검증 결과, 핵심 발견 사항, 남아있는 불확실성을 포함하세요.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...this.context.getFacilitatorHistory(),
      { role: 'user', content: prompt },
    ];

    let content = '';
    const res = await this.provider.chatStream(messages, this.harness.maxTokensPerTurn * 2, (chunk) => {
      content += chunk;
      this.onChunk(chunk);
    });

    return { content: res.content, tokenCount: res.tokenCount };
  }
}
