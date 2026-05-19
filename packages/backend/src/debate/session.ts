import { db } from '../db/client';
import { HarnessConfig, DEFAULT_HARNESS } from './harness';

export interface DebateSession {
  id: string;
  user_id: string;
  topic: string;
  description: string;
  state: string;
  harness_config: HarnessConfig;
  facilitator_key_id: string | null;
  debater_a_key_id: string | null;
  debater_b_key_id: string | null;
  facilitator_model: string;
  debater_a_model: string;
  debater_b_model: string;
  round_current: number;
  token_total: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export async function create(
  userId: string,
  topic: string,
  description: string,
  harnessConfig: Partial<HarnessConfig>,
  facilitatorKeyId: string | null,
  debaterAKeyId: string | null,
  debaterBKeyId: string | null,
  facilitatorModel: string,
  debaterAModel: string,
  debaterBModel: string,
): Promise<DebateSession> {
  const harness = { ...DEFAULT_HARNESS, ...harnessConfig };
  const { rows } = await db.query<DebateSession>(
    `INSERT INTO debate_sessions
       (user_id, topic, description, harness_config,
        facilitator_key_id, debater_a_key_id, debater_b_key_id,
        facilitator_model, debater_a_model, debater_b_model)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [userId, topic, description, JSON.stringify(harness), facilitatorKeyId, debaterAKeyId, debaterBKeyId,
     facilitatorModel, debaterAModel, debaterBModel],
  );
  return rows[0];
}

export async function countDefaultApiSessionsToday(userId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM debate_sessions
      WHERE user_id = $1
        AND facilitator_key_id IS NULL
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'`,
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function findById(sessionId: string, userId: string): Promise<DebateSession | null> {
  const { rows } = await db.query<DebateSession>(
    `SELECT * FROM debate_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  return rows[0] ?? null;
}

export async function listByUser(userId: string): Promise<DebateSession[]> {
  const { rows } = await db.query<DebateSession>(
    `SELECT * FROM debate_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function remove(sessionId: string, userId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM debate_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function updateState(
  sessionId: string,
  state: string,
  extra: Partial<{ round_current: number; token_total: number; ended_at: string }> = {},
) {
  const fields = ['state = $2'];
  const values: unknown[] = [sessionId, state];
  let idx = 3;

  if (extra.round_current !== undefined) {
    fields.push(`round_current = $${idx++}`);
    values.push(extra.round_current);
  }
  if (extra.token_total !== undefined) {
    fields.push(`token_total = $${idx++}`);
    values.push(extra.token_total);
  }
  if (extra.ended_at !== undefined) {
    fields.push(`ended_at = $${idx++}`);
    values.push(extra.ended_at);
  }
  if (state === 'running') {
    fields.push(`started_at = NOW()`);
  }

  await db.query(`UPDATE debate_sessions SET ${fields.join(', ')} WHERE id = $1`, values);
}

export async function saveMessage(
  sessionId: string,
  round: number,
  role: string,
  content: string,
  tokenCount: number,
) {
  await db.query(
    `INSERT INTO debate_messages (session_id, round, role, content, token_count)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, round, role, content, tokenCount],
  );
}

export async function updateModels(
  sessionId: string,
  userId: string,
  facilitatorKeyId: string,
  debaterAKeyId: string,
  debaterBKeyId: string,
  facilitatorModel: string,
  debaterAModel: string,
  debaterBModel: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE debate_sessions
     SET facilitator_key_id=$3, debater_a_key_id=$4, debater_b_key_id=$5,
         facilitator_model=$6,  debater_a_model=$7,  debater_b_model=$8,
         state = CASE WHEN state = 'error' THEN 'idle' ELSE state END
     WHERE id=$1 AND user_id=$2 AND state != 'running' AND state != 'done'`,
    [sessionId, userId,
     facilitatorKeyId, debaterAKeyId, debaterBKeyId,
     facilitatorModel, debaterAModel, debaterBModel],
  );
  return (rowCount ?? 0) > 0;
}

export async function getMessages(sessionId: string) {
  const { rows } = await db.query(
    `SELECT * FROM debate_messages WHERE session_id = $1 ORDER BY round, created_at`,
    [sessionId],
  );
  return rows;
}

export async function clearMessages(sessionId: string) {
  await db.query(`DELETE FROM debate_messages WHERE session_id = $1`, [sessionId]);
}
