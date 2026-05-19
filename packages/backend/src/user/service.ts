import { db } from '../db/client';

export interface User {
  id: string;
  display_name: string;
  created_at: string;
}

export async function findById(userId: string): Promise<User | null> {
  const { rows } = await db.query<User>(
    `SELECT id, display_name, created_at FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
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

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  apiMode: 'default',
  facilitatorKeyId: '', facilitatorModel: '',
  debaterAKeyId: '', debaterAModel: '',
  debaterBKeyId: '', debaterBModel: '',
};

function normalizeModelSettings(settings?: Partial<ModelSettings>): ModelSettings {
  return { ...DEFAULT_MODEL_SETTINGS, ...settings };
}

export async function getModelSettings(userId: string): Promise<ModelSettings> {
  const { rows } = await db.query<{ model_settings: Partial<ModelSettings> }>(
    `SELECT model_settings FROM users WHERE id = $1`,
    [userId],
  );
  return normalizeModelSettings(rows[0]?.model_settings);
}

export async function saveModelSettings(userId: string, settings: ModelSettings): Promise<void> {
  await db.query(
    `UPDATE users SET model_settings = $2 WHERE id = $1`,
    [userId, JSON.stringify(settings)],
  );
}
