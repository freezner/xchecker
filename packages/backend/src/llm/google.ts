import { LLMContentPart, LLMMessage, LLMProvider, LLMResponse } from './provider';

export class GoogleProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gemini-1.5-pro',
  ) {}

  private toParts(content: string | LLMContentPart[]) {
    if (typeof content === 'string') return [{ text: content }];
    return content.map((p) =>
      p.type === 'text'
        ? { text: p.text }
        : { inline_data: { mime_type: p.mimeType, data: p.base64 } },
    );
  }

  private toGeminiContents(messages: LLMMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');
    return {
      systemInstruction: systemMsg
        ? { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : '' }] }
        : undefined,
      contents: chatMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: this.toParts(m.content),
      })),
    };
  }

  async chat(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
    const { systemInstruction, contents } = this.toGeminiContents(messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Google [${this.model}]: ${msg}`);
    }

    const data = await res.json() as {
      candidates: { content: { parts: { text?: string; thought?: boolean }[] } }[];
      usageMetadata: { totalTokenCount: number };
    };

    const parts = data.candidates[0].content.parts.filter((p) => !p.thought);
    return {
      content: parts.map((p) => p.text ?? '').join(''),
      tokenCount: data.usageMetadata.totalTokenCount,
    };
  }

  async chatStream(
    messages: LLMMessage[],
    maxTokens: number,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse> {
    const { systemInstruction, contents } = this.toGeminiContents(messages);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Google [${this.model}]: ${msg}`);
    }

    let fullContent = '';
    let totalTokens = 0;

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!; // keep incomplete last line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        const event = JSON.parse(raw) as {
          candidates?: { content: { parts: { text?: string; thought?: boolean }[] } }[];
          usageMetadata?: { totalTokenCount: number };
        };

        const parts = event.candidates?.[0]?.content?.parts?.filter((p) => !p.thought) ?? [];
        const text = parts.map((p) => p.text ?? '').join('');
        if (text) {
          fullContent += text;
          onChunk(text);
        }
        if (event.usageMetadata) {
          totalTokens = event.usageMetadata.totalTokenCount;
        }
      }
    }

    return { content: fullContent, tokenCount: totalTokens };
  }
}
