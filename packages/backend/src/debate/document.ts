import { db } from '../db/client';

export interface DebateDocument {
  id: string;
  session_id: string;
  user_id: string;
  filename: string;
  mime_type: string;
  size: number;
  content: string; // plain text for text files, base64 for images
  created_at: string;
}

export type DebateDocumentMeta = Omit<DebateDocument, 'content'>;

export async function createDocument(
  sessionId: string,
  userId: string,
  filename: string,
  mimeType: string,
  size: number,
  content: string,
): Promise<DebateDocumentMeta> {
  const { rows } = await db.query<DebateDocument>(
    `INSERT INTO debate_documents (session_id, user_id, filename, mime_type, size, content)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, session_id, user_id, filename, mime_type, size, created_at`,
    [sessionId, userId, filename, mimeType, size, content],
  );
  return rows[0];
}

export async function listDocuments(sessionId: string, userId: string): Promise<DebateDocumentMeta[]> {
  const { rows } = await db.query<DebateDocumentMeta>(
    `SELECT id, session_id, user_id, filename, mime_type, size, created_at
     FROM debate_documents WHERE session_id=$1 AND user_id=$2 ORDER BY created_at`,
    [sessionId, userId],
  );
  return rows;
}

export async function deleteDocument(docId: string, userId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM debate_documents WHERE id=$1 AND user_id=$2`,
    [docId, userId],
  );
  return (rowCount ?? 0) > 0;
}

/** Load full content for engine use — no user_id filter (internal use) */
export async function listDocumentsWithContent(sessionId: string): Promise<DebateDocument[]> {
  const { rows } = await db.query<DebateDocument>(
    `SELECT * FROM debate_documents WHERE session_id=$1 ORDER BY created_at`,
    [sessionId],
  );
  return rows;
}
