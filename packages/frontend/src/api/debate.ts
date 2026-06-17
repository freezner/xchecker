import { api } from './client';

export interface HarnessConfig {
  maxRounds?: number;
  maxTimeSeconds?: number;
  maxTokensPerTurn?: number;
  maxTotalTokens?: number;
  stopOnConsensus?: boolean;
  debateRules?: string;
}

export interface DebateSession {
  id: string;
  topic: string;
  description: string;
  state: string;
  harness_config: HarnessConfig;
  facilitator_key_id: string;
  debater_a_key_id: string;
  debater_b_key_id: string;
  facilitator_model: string;
  debater_a_model: string;
  debater_b_model: string;
  round_current: number;
  token_total: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface DebateMessage {
  id: string;
  round: number;
  role: 'facilitator' | 'debater_a' | 'debater_b' | 'system';
  content: string;
  created_at: string;
}

export const debateApi = {
  list: () => api.get<DebateSession[]>('/api/debates'),

  create: (params: {
    topic: string;
    description?: string;
    harness?: HarnessConfig;
  }) => api.post<DebateSession>('/api/debates', params),

  get: (id: string) =>
    api.get<DebateSession & { messages: DebateMessage[] }>(`/api/debates/${id}`),

  stop: (id: string) => api.post(`/api/debates/${id}/stop`, {}),

  delete: (id: string) => api.delete<void>(`/api/debates/${id}`),

  updateModels: (
    id: string,
    params: {
      facilitatorKeyId: string;
      debaterAKeyId: string;
      debaterBKeyId: string;
      facilitatorModel: string;
      debaterAModel: string;
      debaterBModel: string;
    },
  ) => api.patch<DebateSession>(`/api/debates/${id}/models`, params),

  exportMd: (id: string) => `${import.meta.env.VITE_API_URL ?? ''}/api/debates/${id}/export/md`,
  exportDocx: (id: string) => `${import.meta.env.VITE_API_URL ?? ''}/api/debates/${id}/export/docx`,
  exportHwpx: (id: string) => `${import.meta.env.VITE_API_URL ?? ''}/api/debates/${id}/export/hwpx`,
};
