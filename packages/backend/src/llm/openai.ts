import { LLMContentPart, LLMMessage, LLMProvider, LLMResponse } from './provider';

function toOpenAIContent(content: string | LLMContentPart[]) {
  if (typeof content === 'string') return content;
  return content.map((p) =>
    p.type === 'text'
      ? { type: 'text', text: p.text }
      : { type: 'image_url', image_url: { url: `data:${p.mimeType};base64,${p.base64}` } },
  );
}

export class OpenAIProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string = 'gpt-4o',
  ) {}

  async chat(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      const code = body.error?.code ? ` (${body.error.code})` : '';
      throw new Error(`OpenAI [${this.model}]: ${msg}${code}`);
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[];
      usage: { total_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      tokenCount: data.usage.total_tokens,
    };
  }

  async chatStream(
    messages: LLMMessage[],
    maxTokens: number,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      const code = body.error?.code ? ` (${body.error.code})` : '';
      throw new Error(`OpenAI [${this.model}]: ${msg}${code}`);
    }

    let fullContent = '';
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
        const chunk = JSON.parse(raw) as {
          choices: { delta: { content?: string } }[];
        };
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          fullContent += text;
          onChunk(text);
        }
      }
    }

    // 스트리밍은 토큰 수를 정확히 알 수 없으므로 추정
    return { content: fullContent, tokenCount: Math.ceil(fullContent.length / 4) };
  }
}
