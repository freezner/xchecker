# xchecker - 멀티 LLM 토론 팩트체킹 시스템 설계

## 1. 시스템 개요

단일 LLM 편향을 방지하기 위해 **진행 위임자(Facilitator)**, **토론자A**, **토론자B**가 각기 다른 LLM API를 사용해 하나의 주제를 다각도로 검증하는 웹 서비스.

```
사용자 입력 (주제)
     │
     ▼
┌─────────────────┐
│  Facilitator    │  ← 토론 정책 수립, 라운드 조율, 최종 합산
│  (LLM A)        │
└────────┬────────┘
         │ 격리된 질문 전달
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Debater │ │Debater │  ← 서로 컨텍스트 공유 없음
│   A    │ │   B    │  ← 각기 다른 LLM API 가능
│(LLM B) │ │(LLM C) │
└────────┘ └────────┘
    │         │
    └────┬────┘
         ▼
  Facilitator 합산 → 결과 도출 → MD/DOCX 내보내기
```

---

## 2. 토론 하네스 (Debate Harness)

토론이 무한 재귀나 과도한 토큰 소비로 이어지지 않도록 제어하는 설정 집합.

### 2.1 하네스 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `maxRounds` | int | 5 | 최대 토론 라운드 수 |
| `maxTimeSeconds` | int | 300 | 전체 토론 최대 허용 시간(초) |
| `maxTokensPerTurn` | int | 1000 | 한 턴당 최대 토큰 수 |
| `maxTotalTokens` | int | 20000 | 세션 전체 누적 최대 토큰 수 |
| `facilitatorModel` | string | - | Facilitator에 사용할 LLM 모델 |
| `debaterAModel` | string | - | 토론자A에 사용할 LLM 모델 |
| `debaterBModel` | string | - | 토론자B에 사용할 LLM 모델 |
| `stopOnConsensus` | bool | true | Facilitator가 합의 도달 판단 시 조기 종료 |
| `consensusPrompt` | string | 내장 | Facilitator가 합의 여부를 판단하는 프롬프트 |

### 2.2 하네스 체크포인트

각 라운드 시작 전 Facilitator가 아래 조건을 확인:

```
[하네스 체크]
1. 경과 시간 > maxTimeSeconds → 강제 종료, 현재까지 합산
2. 누적 토큰 > maxTotalTokens → 강제 종료
3. 현재 라운드 > maxRounds → 강제 종료
4. stopOnConsensus=true && 합의 판정 → 조기 종료
```

### 2.3 컨텍스트 격리 구조

```
DebateSession
├── facilitatorHistory: Message[]   ← Facilitator 전용 (A+B 답변 요약 포함)
├── debaterAHistory: Message[]      ← 토론자A 전용 (자신의 답변 + Facilitator 질문만)
└── debaterBHistory: Message[]      ← 토론자B 전용 (자신의 답변 + Facilitator 질문만)
```

토론자A와 B는 서로의 히스토리를 절대 참조하지 않음.
Facilitator만 두 토론자의 답변을 볼 수 있으며, Facilitator의 합산 내용도 토론자에게 전달하지 않음.

---

## 3. 토론 흐름 (State Machine)

```
IDLE → POLICY_SETUP → ROUND_START → DEBATER_A_TURN → DEBATER_B_TURN
       → FACILITATOR_SYNTHESIS → [HARNESS_CHECK] → ROUND_START (반복)
       → CONCLUSION → EXPORT_READY
```

각 상태는 DB에 저장되어 중단 후 재개 가능.

---

## 4. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 언어 | TypeScript | 프론트/백 통일, 타입 안전성 |
| 백엔드 프레임워크 | Fastify | 경량, 플러그인 생태계, WebSocket 지원 |
| 프론트엔드 | React + Vite | SPA, 실시간 토론 UI |
| 데이터베이스 | PostgreSQL | 계정별 격리, JSON 컬럼 지원 |
| 실시간 통신 | WebSocket (fastify-websocket) | 토론 진행 상황 스트리밍 |
| 인증 | Passkey (WebAuthn) | 비밀번호 없는 인증 |
| 내보내기 | markdown-it, docx | MD/DOCX 생성 |
| 컨테이너 | Docker Compose | 개발/배포 일원화 |
| 인프라 | Hetzner + Cloudflare | 서버 + CDN/도메인 |

---

## 5. 프로젝트 디렉토리 구조

```
xchecker/
├── docker-compose.yml              # 개발 환경
├── docker-compose.prod.yml         # 프로덕션 환경
├── .env.example
├── packages/
│   ├── backend/                    # Fastify API 서버
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts             # 서버 엔트리포인트
│   │       ├── config.ts           # 환경변수 로드
│   │       ├── db/
│   │       │   ├── client.ts       # PostgreSQL 연결
│   │       │   └── migrations/     # SQL 마이그레이션 파일
│   │       ├── auth/               # Passkey(WebAuthn) 인증
│   │       │   ├── routes.ts
│   │       │   ├── service.ts
│   │       │   └── session.ts
│   │       ├── user/               # 사용자 계정 & 설정
│   │       │   ├── routes.ts
│   │       │   ├── service.ts
│   │       │   └── model.ts
│   │       ├── api-keys/           # LLM API 키 관리 (암호화 저장)
│   │       │   ├── routes.ts
│   │       │   ├── service.ts
│   │       │   └── crypto.ts
│   │       ├── llm/                # LLM 프로바이더 추상화
│   │       │   ├── provider.ts     # 인터페이스 정의
│   │       │   ├── openai.ts
│   │       │   ├── anthropic.ts
│   │       │   ├── google.ts
│   │       │   └── registry.ts     # 프로바이더 등록/조회
│   │       ├── debate/             # 핵심 토론 엔진
│   │       │   ├── routes.ts
│   │       │   ├── session.ts      # DebateSession 상태 관리
│   │       │   ├── harness.ts      # 하네스 체크포인트 로직
│   │       │   ├── facilitator.ts  # Facilitator 역할 로직
│   │       │   ├── debater.ts      # Debater 역할 로직
│   │       │   ├── context.ts      # 격리된 컨텍스트 관리
│   │       │   └── engine.ts       # 토론 오케스트레이터
│   │       └── export/             # 결과 내보내기
│   │           ├── routes.ts
│   │           ├── markdown.ts
│   │           └── docx.ts
│   └── frontend/                   # React + Vite SPA
│       ├── Dockerfile
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.tsx
│           ├── api/                # 백엔드 API 클라이언트
│           │   ├── client.ts
│           │   ├── debate.ts
│           │   └── user.ts
│           ├── components/
│           │   ├── debate/
│           │   │   ├── DebateSetup.tsx      # 주제 + 하네스 설정 폼
│           │   │   ├── DebateSession.tsx    # 실시간 토론 뷰
│           │   │   ├── DebaterPanel.tsx     # 토론자 응답 패널
│           │   │   ├── FacilitatorPanel.tsx # 진행자 패널
│           │   │   └── HarnessStatus.tsx   # 하네스 상태 표시
│           │   ├── settings/
│           │   │   ├── ApiKeyManager.tsx   # API 키 등록/삭제
│           │   │   └── ModelSelector.tsx   # 역할별 모델 선택
│           │   └── ui/                     # 공통 UI 컴포넌트
│           └── pages/
│               ├── HomePage.tsx
│               ├── DebatePage.tsx
│               ├── HistoryPage.tsx
│               └── SettingsPage.tsx
├── infra/
│   ├── nginx/
│   │   └── nginx.conf
│   └── postgres/
│       └── init.sql
└── DESIGN.md
```

---

## 6. 데이터베이스 스키마

```sql
-- 사용자
users (
  id UUID PK,
  display_name TEXT,
  created_at TIMESTAMPTZ
)

-- Passkey 자격증명 (WebAuthn)
passkey_credentials (
  id UUID PK,
  user_id UUID FK → users,
  credential_id BYTEA UNIQUE,
  public_key BYTEA,
  sign_count BIGINT,
  created_at TIMESTAMPTZ
)

-- 암호화된 LLM API 키
user_api_keys (
  id UUID PK,
  user_id UUID FK → users,
  provider TEXT,          -- 'openai' | 'anthropic' | 'google' | ...
  encrypted_key TEXT,     -- AES-256-GCM 암호화
  label TEXT,
  created_at TIMESTAMPTZ
)

-- 토론 세션
debate_sessions (
  id UUID PK,
  user_id UUID FK → users,
  topic TEXT,
  state TEXT,             -- state machine 상태
  harness_config JSONB,   -- DebateHarness 파라미터
  facilitator_model TEXT,
  debater_a_model TEXT,
  debater_b_model TEXT,
  round_current INT,
  token_total INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- 토론 메시지 (격리 저장)
debate_messages (
  id UUID PK,
  session_id UUID FK → debate_sessions,
  round INT,
  role TEXT,              -- 'facilitator' | 'debater_a' | 'debater_b'
  speaker TEXT,           -- 'facilitator' | 'debater_a' | 'debater_b' | 'system'
  content TEXT,
  token_count INT,
  created_at TIMESTAMPTZ
)
```

---

## 7. API 엔드포인트 개요

```
POST   /api/auth/register/begin        # Passkey 등록 시작
POST   /api/auth/register/finish       # Passkey 등록 완료
POST   /api/auth/login/begin           # Passkey 로그인 시작
POST   /api/auth/login/finish          # Passkey 로그인 완료
DELETE /api/auth/logout

GET    /api/user/me                    # 내 프로필
GET    /api/user/api-keys              # 등록된 API 키 목록 (키 값은 비공개)
POST   /api/user/api-keys              # API 키 등록
DELETE /api/user/api-keys/:id          # API 키 삭제

GET    /api/debates                    # 내 토론 목록
POST   /api/debates                    # 토론 생성
GET    /api/debates/:id                # 토론 상세
POST   /api/debates/:id/start          # 토론 시작
POST   /api/debates/:id/stop           # 토론 강제 중단
GET    /api/debates/:id/export/md      # MD 내보내기
GET    /api/debates/:id/export/docx    # DOCX 내보내기

WS     /ws/debates/:id                 # 실시간 토론 스트리밍
```

---

## 8. LLM 프로바이더 인터페이스

```typescript
// packages/backend/src/llm/provider.ts
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  tokenCount: number;
}

interface LLMProvider {
  chat(messages: LLMMessage[], maxTokens: number): Promise<LLMResponse>;
}

// 지원 프로바이더: OpenAI, Anthropic, Google Gemini
// 추후 추가: Mistral, Cohere 등
```

---

## 9. Docker Compose 구성

```yaml
# docker-compose.yml (개발)
services:
  postgres:
    image: postgres:16
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment: { POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD }

  backend:
    build: ./packages/backend
    ports: ["3001:3001"]
    depends_on: [postgres]
    environment: { DATABASE_URL, ENCRYPTION_KEY, ... }
    volumes: [./packages/backend/src:/app/src]  # hot reload

  frontend:
    build: ./packages/frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    volumes: [./packages/frontend/src:/app/src]  # hot reload

  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    depends_on: [backend, frontend]
    volumes: [./infra/nginx/nginx.conf:/etc/nginx/nginx.conf]
```

---

## 10. 배포 아키텍처 (Hetzner + Cloudflare)

```
사용자 브라우저
     │ HTTPS
     ▼
Cloudflare (CDN, DDoS 보호, 도메인 SSL)
     │
     ▼
Hetzner 서버
├── nginx (리버스 프록시, 포트 80/443)
├── frontend (React 정적 파일 서빙 or Node.js)
├── backend (Fastify API + WebSocket)
└── postgres (로컬 DB 또는 별도 볼륨)
```

---

## 11. 보안 고려사항

- LLM API 키는 AES-256-GCM으로 암호화 후 DB 저장 (복호화 키는 서버 환경변수)
- WebAuthn Passkey로 패스워드리스 인증
- 세션 쿠키는 HttpOnly + Secure + SameSite=Strict
- 사용자별 토론 세션 격리 (DB 레벨 user_id 필터)
- API 키 등록 후 원본 값은 절대 재조회 불가 (암호화 단방향 마스킹으로 표시)

---

## 12. 구현 우선순위 (Phase)

| Phase | 내용 |
|---|---|
| P1 | DB 스키마 + Passkey 인증 + 사용자/API키 관리 |
| P2 | LLM 프로바이더 추상화 + 토론 엔진 + 하네스 |
| P3 | WebSocket 실시간 스트리밍 + 프론트엔드 토론 UI |
| P4 | MD/DOCX 내보내기 + 토론 히스토리 |
| P5 | Docker Compose 배포 + Cloudflare/Hetzner 설정 |
