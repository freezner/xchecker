CREATE TABLE IF NOT EXISTS debate_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES debate_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size        INT NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,  -- plain text for text files, base64 for images
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debate_documents_session ON debate_documents(session_id);
