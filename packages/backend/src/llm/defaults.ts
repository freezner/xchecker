import { config } from '../config';

export interface ResolvedDefaultLLM {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  facilitatorModel: string;
  debaterAModel: string;
  debaterBModel: string;
}

export function getDefaultLLMConfig(): ResolvedDefaultLLM | null {
  if (!config.DEFAULT_LLM_PROVIDER || !config.DEFAULT_LLM_API_KEY) return null;

  return {
    provider: config.DEFAULT_LLM_PROVIDER,
    apiKey: config.DEFAULT_LLM_API_KEY,
    facilitatorModel: config.DEFAULT_FACILITATOR_MODEL ?? '',
    debaterAModel: config.DEFAULT_DEBATER_A_MODEL ?? config.DEFAULT_FACILITATOR_MODEL ?? '',
    debaterBModel: config.DEFAULT_DEBATER_B_MODEL ?? config.DEFAULT_FACILITATOR_MODEL ?? '',
  };
}

export function getDefaultLLMConfigOrThrow(): ResolvedDefaultLLM {
  const llm = getDefaultLLMConfig();
  if (!llm || !llm.facilitatorModel || !llm.debaterAModel || !llm.debaterBModel) {
    throw new Error('기본 제공 LLM 설정이 서버에 구성되어 있지 않습니다.');
  }
  return llm;
}
