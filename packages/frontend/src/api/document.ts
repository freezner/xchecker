import { api } from './client';

export interface DebateDocument {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export const documentApi = {
  list: (sessionId: string) =>
    api.get<DebateDocument[]>(`/api/debates/${sessionId}/documents`),

  upload: (sessionId: string, params: { filename: string; mimeType: string; content: string }) =>
    api.post<DebateDocument>(`/api/debates/${sessionId}/documents`, params),

  delete: (sessionId: string, docId: string) =>
    api.delete<void>(`/api/debates/${sessionId}/documents/${docId}`),

  fetchUrl: (sessionId: string, url: string) =>
    api.post<DebateDocument>(`/api/debates/${sessionId}/documents/fetch`, { url }),
};

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:mime/type;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
