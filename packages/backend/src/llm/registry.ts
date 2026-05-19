import { LLMProvider } from './provider';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { GoogleProvider } from './google';

export function createProvider(provider: string, apiKey: string, model: string): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'google':
      return new GoogleProvider(apiKey, model);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

// 프로바이더별 사용 가능한 모델 목록
export const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'],
};
