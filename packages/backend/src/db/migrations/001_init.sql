-- 사용자
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Passkey 자격증명 (WebAuthn)
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,  -- Base64URL
  public_key    BYTEA NOT NULL,
  sign_count    BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 암호화된 LLM API 키
CREATE TABLE IF NOT EXISTS user_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,  -- 'openai' | 'anthropic' | 'google'
  label         TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,  -- AES-256-GCM 암호화값
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 토론 세션
CREATE TABLE IF NOT EXISTS debate_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic             TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'idle',
  harness_config    JSONB NOT NULL,
  facilitator_key_id  UUID REFERENCES user_api_keys(id),
  debater_a_key_id    UUID REFERENCES user_api_keys(id),
  debater_b_key_id    UUID REFERENCES user_api_keys(id),
  facilitator_model   TEXT NOT NULL DEFAULT '',
  debater_a_model     TEXT NOT NULL DEFAULT '',
  debater_b_model     TEXT NOT NULL DEFAULT '',
  round_current       INT NOT NULL DEFAULT 0,
  token_total       INT NOT NULL DEFAULT 0,
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 토론 메시지 (역할별 격리 조회)
CREATE TABLE IF NOT EXISTS debate_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES debate_sessions(id) ON DELETE CASCADE,
  round       INT NOT NULL,
  role        TEXT NOT NULL,  -- 'facilitator' | 'debater_a' | 'debater_b' | 'system'
  content     TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debate_messages_session ON debate_messages(session_id, round);
CREATE INDEX IF NOT EXISTS idx_debate_sessions_user ON debate_sessions(user_id);
