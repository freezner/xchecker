import { db } from '../db/client';
import { encrypt, decrypt } from './crypto';

export interface ApiKeyRecord {
  id: string;
  provider: string;
  label: string;
  created_at: string;
}

export async function list(userId: string): Promise<ApiKeyRecord[]> {
  const { rows } = await db.query<ApiKeyRecord>(
    `SELECT id, provider, label, created_at FROM user_api_keys WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return rows;
}

export async function create(
  userId: string,
  provider: string,
  label: string,
  apiKey: string,
): Promise<ApiKeyRecord> {
  const encryptedKey = encrypt(apiKey);
  const { rows } = await db.query<ApiKeyRecord>(
    `INSERT INTO user_api_keys (user_id, provider, label, encrypted_key)
     VALUES ($1, $2, $3, $4)
     RETURNING id, provider, label, created_at`,
    [userId, provider, label, encryptedKey],
  );
  return rows[0];
}

export async function updateLabel(userId: string, keyId: string, label: string): Promise<ApiKeyRecord> {
  const { rows } = await db.query<ApiKeyRecord>(
    `UPDATE user_api_keys SET label = $1 WHERE id = $2 AND user_id = $3
     RETURNING id, provider, label, created_at`,
    [label, keyId, userId],
  );
  if (!rows[0]) throw new Error('API key not found');
  return rows[0];
}

export async function remove(userId: string, keyId: string): Promise<void> {
  await db.query(
    `DELETE FROM user_api_keys WHERE id = $1 AND user_id = $2`,
    [keyId, userId],
  );
}

// 내부 전용 - LLM 호출 시 복호화, provider 타입도 함께 반환
export async function getDecryptedKey(
  userId: string,
  keyId: string,
): Promise<{ apiKey: string; provider: string }> {
  const { rows } = await db.query<{ encrypted_key: string; provider: string }>(
    `SELECT encrypted_key, provider FROM user_api_keys WHERE id = $1 AND user_id = $2`,
    [keyId, userId],
  );
  if (!rows[0]) throw new Error('API key not found');
  return { apiKey: decrypt(rows[0].encrypted_key), provider: rows[0].provider };
}
