import { api } from './client';

export interface User {
  id: string;
  display_name: string;
  created_at: string;
}

export interface ApiKeyRecord {
  id: string;
  provider: string;
  label: string;
  created_at: string;
}

export interface ModelSettings {
  apiMode: 'default' | 'custom';
  facilitatorKeyId: string;
  facilitatorModel: string;
  debaterAKeyId: string;
  debaterAModel: string;
  debaterBKeyId: string;
  debaterBModel: string;
}

export const userApi = {
  me: () => api.get<User>('/api/user/me'),
  listApiKeys: () => api.get<ApiKeyRecord[]>('/api/user/api-keys'),
  addApiKey: (provider: string, label: string, apiKey: string) =>
    api.post<ApiKeyRecord>('/api/user/api-keys', { provider, label, apiKey }),
  updateApiKeyLabel: (id: string, label: string) =>
    api.patch<ApiKeyRecord>(`/api/user/api-keys/${id}`, { label }),
  deleteApiKey: (id: string) => api.delete(`/api/user/api-keys/${id}`),
  listProviders: () => api.get<Record<string, string[]>>('/api/providers'),
  getModelSettings: () => api.get<ModelSettings>('/api/user/model-settings'),
  saveModelSettings: (s: ModelSettings) => api.put<ModelSettings>('/api/user/model-settings', s),
};
