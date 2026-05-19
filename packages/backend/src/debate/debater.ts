import { LLMProvider, LLMMessage } from '../llm/provider';
import { IsolatedContext } from './context';
import { HarnessConfig } from './harness';
import { DebateDocument } from './document';

const DEBATER_SYSTEM = (role: 'A' | 'B') =>
  `당신은 독립적인 분석가 ${role}입니다.
주어진 질문에 대해 사실과 논리에 기반한 솔직한 의견을 제시하세요.
다른 분석가의 의견을 모르는 상태에서 독립적으로 분석합니다.

출처 표기 지침:
- 특정 사실, 통계, 연구 결과를 주장할 때는 반드시 출처를 명시하세요.
- 참고 자료로 제공된 문서나 URL의 내용을 인용할 때는 "[출처: 파일명 또는 URL]" 형식으로 표기하세요.
- 외부 기사, 논문, 보고서를 근거로 사용할 경우 "[출처: 제목, 발행처/URL]" 형식으로 표기하세요.
- 출처가 불분명한 주장은 "~로 알려져 있음" 또는 "~라는 주장이 있음"으로 표현하고 출처 표기를 생략하세요.
- 팩트 체크 목적이므로 근거 없는 주장보다 출처가 명확한 사실에 집중하세요.

응답은 항상 한국어로, 명확하고 간결하게 작성하세요.`;

export class DebaterRole {
  private systemPrompt: string;

  constructor(
    private provider: LLMProvider,
    private role: 'A' | 'B',
    private context: IsolatedContext,
    private harness: HarnessConfig,
    private onChunk: (chunk: string) => void,
    documents: DebateDocument[] = [],
    description = '',
  ) {
    const descNote = description.trim() ? `\n\n[토론 배경]\n${description.trim()}` : '';
    const textDocs = documents.filter((d) => !d.mime_type.startsWith('image/'));
    const docNote = textDocs.length > 0
      ? '\n\n[참고 자료]\n' + textDocs.map((d) => `--- ${d.filename} ---\n${d.content}`).join('\n\n')
      : '';
    this.systemPrompt = DEBATER_SYSTEM(role) + descNote + docNote;
  }

  async respond(question: string): Promise<{ content: string; tokenCount: number }> {
    const history = this.role === 'A'
      ? this.context.getDebaterAHistory()
      : this.context.getDebaterBHistory();

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: question },
    ];

    const res = await this.provider.chatStream(
      messages,
      this.harness.maxTokensPerTurn,
      this.onChunk,
    );

    // 격리된 컨텍스트에 자신의 히스토리만 추가
    const addToContext = this.role === 'A'
      ? this.context.addDebaterA.bind(this.context)
      : this.context.addDebaterB.bind(this.context);

    addToContext({ role: 'user', content: question });
    addToContext({ role: 'assistant', content: res.content });

    return { content: res.content, tokenCount: res.tokenCount };
  }
}
