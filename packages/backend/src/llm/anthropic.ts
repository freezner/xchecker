import { LLMContentPart, LLMMessage, LLMProvider, LLMResponse } from './provider';

export class AnthropicProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string = 'claude-sonnet-4-6',
  ) {}

  private toAnthropicContent(content: string | LLMContentPart[]) {
    if (typeof content === 'string') return content;
    return content.map((p) =>
      p.type === 'text'
        ? { type: 'text', text: p.text }
        : { type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.base64 } },
    );
  }

  private toAnthropicMessages(messages: LLMMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');
    return {
      system: typeof systemMsg?.content === 'string' ? systemMsg.content : undefined,
      messages: chatMessages.map((m) => ({ role: m.role, content: this.toAnthropicContent(m.content) })),
    };
  }

  async chat(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse> {
    const { system, messages: msgs } = this.toAnthropicMessages(messages);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages: msgs }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string; type?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Anthropic [${this.model}]: ${msg}`);
    }

    const data = await res.json() as {
      content: { text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0].text,
      tokenCount: data.usage.input_tokens + data.usage.output_tokens,
    };
  }

  async chatStream(
    messages: LLMMessage[],
    maxTokens: number,
    onChunk: (chunk: string) => void,
  ): Promise<LLMResponse> {
    const { system, messages: msgs } = this.toAnthropicMessages(messages);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: msgs,
        stream: true,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Anthropic [${this.model}]: ${msg}`);
    }

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

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
          type: string;
          delta?: { text?: string };
          usage?: { input_tokens: number; output_tokens: number };
          message?: { usage: { input_tokens: number } };
        };

        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullContent += event.delta.text;
          onChunk(event.delta.text);
        } else if (event.type === 'message_start' && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }
    }

    return { content: fullContent, tokenCount: inputTokens + outputTokens };
  }
}
