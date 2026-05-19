# xchecker

멀티 LLM 토픽 검증 웹 서비스입니다. 하나의 토픽을 진행자(Facilitator), 토론자 A, 토론자 B 역할로 나누고 서로 다른 LLM 모델을 연결해 단일 모델 편향을 줄이는 방식으로 검증 결과를 생성합니다.

## 주요 기능

- Passkey(WebAuthn) 기반 로그인/회원가입
- 기본 제공 API 모드와 개별 API 모드
- 사용자별 LLM API 키 암호화 저장
- 역할별 모델 설정
- 토픽 생성 및 상태별 목록 관리
- 생성일 Datepicker 필터와 토픽 삭제
- 참고 자료 업로드 및 URL 수집
  - TXT, Markdown, CSV, JSON
  - PDF, DOCX, XLS/XLSX 텍스트 추출
  - JPG, PNG, WebP, GIF 이미지 참고
- WebSocket 기반 실시간 검증 진행 표시
- 하네스 설정
  - 최대 라운드
  - 최대 진행 시간
  - 턴당 최대 토큰
  - 전체 최대 토큰
  - 합의 도달 시 조기 종료
- 결과 보고서 다운로드
  - Markdown
  - DOCX
  - HWPX

## 기술 스택

- Monorepo: pnpm workspace
- Frontend: React, Vite, Zustand
- Backend: Fastify, TypeScript, PostgreSQL
- Auth: Passkey(WebAuthn), JWT cookie
- Realtime: Fastify WebSocket
- Document export: docx, kordoc
- Deploy: Docker Compose, nginx

## 디렉토리 구조

```text
xchecker/
├── packages/
│   ├── backend/      # Fastify API, LLM provider, debate engine, export
│   └── frontend/     # React SPA
├── docs/             # HWP 템플릿 등 참고 문서
├── infra/nginx/      # nginx 설정
├── docker-compose.yml
├── docker-compose.prod.yml
├── DESIGN.md
└── job.md
```

## 시작하기

### 1. 환경변수 준비

```bash
cp .env.example .env
```

필수 값:

- `DATABASE_URL`
- `JWT_SECRET`
- `ENCRYPTION_KEY`
- `RP_ID`
- `ORIGIN`

`ENCRYPTION_KEY`는 32바이트 hex 문자열입니다.

```bash
openssl rand -hex 32
```

### 2. Docker Compose 실행

```bash
pnpm dev
```

개발 기본 포트:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- nginx: `http://localhost`
- PostgreSQL: `localhost:5432`

### 3. 로컬 개별 실행

PostgreSQL이 이미 준비되어 있다면 패키지별로 실행할 수 있습니다.

```bash
pnpm install
pnpm backend
pnpm frontend
```

## LLM API 모드

### 기본 제공

사용자가 API 키를 등록하지 않아도 서버 공통 LLM 키로 토픽을 생성합니다. 사용자당 하루 2회 생성 제한이 있습니다.

서버 환경변수:

```env
DEFAULT_LLM_PROVIDER=openai
DEFAULT_LLM_API_KEY=...
DEFAULT_FACILITATOR_MODEL=gpt-4o-mini
DEFAULT_DEBATER_A_MODEL=gpt-4o-mini
DEFAULT_DEBATER_B_MODEL=gpt-4o-mini
```

`DEFAULT_DEBATER_A_MODEL`, `DEFAULT_DEBATER_B_MODEL`을 비우면 facilitator 모델을 함께 사용합니다.

### 개별 API

사용자가 설정 화면에서 OpenAI, Anthropic, Google API 키를 직접 등록하고 역할별 모델을 선택합니다. 생성 횟수 제한은 없습니다.

## 주요 API

- `POST /api/auth/register/begin`
- `POST /api/auth/register/finish`
- `POST /api/auth/login/begin`
- `POST /api/auth/login/finish`
- `GET /api/user/me`
- `GET /api/user/model-settings`
- `PUT /api/user/model-settings`
- `GET /api/user/api-keys`
- `POST /api/user/api-keys`
- `DELETE /api/user/api-keys/:id`
- `GET /api/debates`
- `POST /api/debates`
- `GET /api/debates/:id`
- `DELETE /api/debates/:id`
- `POST /api/debates/:id/stop`
- `GET /api/debates/:id/ws`
- `POST /api/debates/:id/documents`
- `POST /api/debates/:id/documents/fetch`
- `GET /api/debates/:id/export/md`
- `GET /api/debates/:id/export/docx`
- `GET /api/debates/:id/export/hwpx`

## 빌드 확인

```bash
pnpm --filter backend build
pnpm --filter frontend build
```

## 보안 메모

- `.env`는 커밋하지 않습니다.
- LLM API 키는 AES-256-GCM으로 암호화해 저장합니다.
- 인증 토큰은 HttpOnly cookie로 발급합니다.
- 프로덕션에서는 `JWT_SECRET`, `ENCRYPTION_KEY`, `RP_ID`, `ORIGIN`을 반드시 실제 환경에 맞게 교체해야 합니다.

## 현재 주의사항

- 기본 제공 API 모드를 쓰려면 서버 공통 LLM 환경변수가 필요합니다.
- Passkey는 브라우저와 도메인/RP 설정에 민감하므로 로컬과 운영 환경의 `RP_ID`, `ORIGIN`을 분리해 관리해야 합니다.
- HWPX export는 Markdown 기반 변환이며 원본 HWP 템플릿 서식을 완전히 복제하지는 않습니다.
