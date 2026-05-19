export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; base64: string };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMResponse {
  content: string;
  tokenCount: number;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse>;
  chatStream(
    messages: LLMMessage[],
    maxTokens: number,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse>;
}
