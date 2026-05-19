import { LLMContentPart, LLMMessage } from '../llm/provider';
import { DebateDocument } from './document';

/**
 * 토론자A와 B의 컨텍스트를 완전히 격리해 관리.
 * Facilitator만 양쪽 답변을 볼 수 있으며, 토론자는 자신의 히스토리만 참조.
 */
export class IsolatedContext {
  private facilitatorHistory: LLMMessage[] = [];
  private debaterAHistory: LLMMessage[] = [];
  private debaterBHistory: LLMMessage[] = [];

  /**
   * 이미지 문서를 초기 히스토리에 주입 (fake exchange로 컨텍스트 공유).
   * 텍스트 문서는 시스템 프롬프트로 처리되므로 여기서는 이미지만 처리.
   */
  preSeedImages(imageDocs: DebateDocument[]) {
    if (imageDocs.length === 0) return;
    const parts: LLMContentPart[] = [
      { type: 'text', text: `토론 참고 이미지 (${imageDocs.map((d) => d.filename).join(', ')})` },
      ...imageDocs.map((d) => ({ type: 'image' as const, mimeType: d.mime_type, base64: d.content })),
    ];
    const userMsg: LLMMessage = { role: 'user', content: parts };
    const ackMsg: LLMMessage = { role: 'assistant', content: '이미지를 확인했습니다. 토론에 참고하겠습니다.' };
    this.facilitatorHistory.push(userMsg, ackMsg);
    this.debaterAHistory.push(userMsg, ackMsg);
    this.debaterBHistory.push(userMsg, ackMsg);
  }

  addFacilitator(msg: LLMMessage) {
    this.facilitatorHistory.push(msg);
  }

  addDebaterA(msg: LLMMessage) {
    this.debaterAHistory.push(msg);
  }

  addDebaterB(msg: LLMMessage) {
    this.debaterBHistory.push(msg);
  }

  getFacilitatorHistory(): LLMMessage[] {
    return [...this.facilitatorHistory];
  }

  getDebaterAHistory(): LLMMessage[] {
    return [...this.debaterAHistory];
  }

  getDebaterBHistory(): LLMMessage[] {
    return [...this.debaterBHistory];
  }
}
