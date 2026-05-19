# xchecker 배포 가이드

대상 환경: 이미 nginx·Docker가 운영 중인 단일 Linux 서버. nginx 설정은 직접 관리하며, 도메인은 `xchecker.freezner.com`으로 DNS가 세팅된 상태를 전제로 합니다.

---

## 1. 소스 배치

```bash
git clone git@github.com:freezner/xchecker.git /opt/xchecker
cd /opt/xchecker
```

SSH 키 없이 HTTPS로 받을 경우:

```bash
git clone https://github.com/freezner/xchecker.git /opt/xchecker
```

---

## 2. 환경변수 작성

```bash
cp .env.example .env
```

`.env` 작성 예시:

```env
POSTGRES_DB=xchecker
POSTGRES_USER=xchecker
POSTGRES_PASSWORD=<강한-비밀번호>

JWT_SECRET=<최소-32자-랜덤>
ENCRYPTION_KEY=<64자-hex>

RP_NAME=xchecker
RP_ID=xchecker.freezner.com
ORIGIN=https://xchecker.freezner.com
WS_ORIGIN=wss://xchecker.freezner.com

# 기본 제공 LLM (선택)
# DEFAULT_LLM_PROVIDER=openai
# DEFAULT_LLM_API_KEY=
# DEFAULT_FACILITATOR_MODEL=gpt-4o-mini
# DEFAULT_DEBATER_A_MODEL=gpt-4o-mini
# DEFAULT_DEBATER_B_MODEL=gpt-4o-mini

BACKEND_PORT=3004
FRONTEND_PORT=3003
```

랜덤 값 생성:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY
openssl rand -base64 32   # POSTGRES_PASSWORD
```

> **주의**: `ENCRYPTION_KEY`는 운영 시작 후 절대 변경하지 마세요. 바꾸면 기존 사용자 API 키를 복호화할 수 없습니다.

---

## 3. 빌드 및 실행

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

컨테이너 상태 확인:

```bash
docker compose -f docker-compose.prod.yml ps
```

백엔드가 정상 기동되면 로컬에서 먼저 확인:

```bash
curl -i http://127.0.0.1:3004/api/health
# {"ok":true}
```

---

## 4. nginx 설정 추가

기존 nginx sites-available에 아래 파일을 추가합니다.

```bash
sudo nano /etc/nginx/sites-available/xchecker.freezner.com
```

```nginx
server {
    listen 80;
    server_name xchecker.freezner.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name xchecker.freezner.com;

    ssl_certificate /etc/letsencrypt/live/xchecker.freezner.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xchecker.freezner.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/xchecker.freezner.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

`BACKEND_PORT`·`FRONTEND_PORT`를 변경했다면 `proxy_pass` 포트도 함께 수정합니다.

---

## 5. TLS 인증서 발급

nginx가 운영 중이므로 **webroot 방식**을 사용합니다.

challenge 디렉터리 확인 (없으면 생성):

```bash
sudo mkdir -p /var/www/certbot
```

발급 (80 서버 블록에 `/.well-known/acme-challenge/` location이 있어야 합니다):

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d xchecker.freezner.com
```

발급 후 nginx reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

갱신 테스트:

```bash
sudo certbot renew --dry-run --cert-name xchecker.freezner.com
```

---

## 6. 최종 확인

```bash
curl -i https://xchecker.freezner.com/api/health
# {"ok":true}
```

브라우저에서 `https://xchecker.freezner.com` 접속 → Passkey 회원가입·로그인 동작 확인.

---

## 7. 업데이트 배포

```bash
cd /opt/xchecker
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker image prune -f
```

---

## 8. 로그 확인

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

---

## 9. 백업

DB dump:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
```

복구:

```bash
cat backup-YYYY-MM-DD.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

안전하게 보관할 항목:

- `.env` (특히 `ENCRYPTION_KEY`)
- PostgreSQL dump

---

## 10. 배포 전 체크리스트

- [ ] `curl http://127.0.0.1:3004/api/health` → `{"ok":true}`
- [ ] nginx 설정에서 `proxy_pass` 포트가 `.env`의 `BACKEND_PORT`·`FRONTEND_PORT`와 일치한다
- [ ] `RP_ID=xchecker.freezner.com` 으로 설정되어 있다
- [ ] `ORIGIN=https://xchecker.freezner.com` 으로 설정되어 있다
- [ ] `WS_ORIGIN=wss://xchecker.freezner.com` 으로 설정되어 있다
- [ ] `ENCRYPTION_KEY`가 64자 hex 문자열이다
- [ ] TLS 인증서가 발급되어 있고 nginx가 443을 처리한다
- [ ] `https://xchecker.freezner.com/api/health` 가 정상 응답한다

---

## 11. 문제 해결

### Passkey 등록·로그인 실패

- `RP_ID`가 접속 도메인과 정확히 일치하는지 확인합니다.
- HTTPS로 접속 중인지 확인합니다.
- Cloudflare 프록시 사용 시 `X-Forwarded-Proto: https`가 전달되는지 확인합니다.

### WebSocket 연결 끊김

- nginx `/api/` location에 `Upgrade`·`Connection` 헤더가 있는지 확인합니다.
- `proxy_read_timeout`이 충분한지 확인합니다 (기본 3600s).
- 브라우저 콘솔에서 WebSocket URL이 `wss://`로 시작하는지 확인합니다.

### 기본 제공 LLM 모드에서 토론 생성 실패

`.env`에 아래 세 값이 모두 설정되어 있는지 확인합니다:

```
DEFAULT_LLM_PROVIDER
DEFAULT_LLM_API_KEY
DEFAULT_FACILITATOR_MODEL
```

### 백엔드 컨테이너가 즉시 종료될 때

```bash
docker compose -f docker-compose.prod.yml logs backend
```

DB 연결 실패가 대부분입니다. `POSTGRES_*` 환경변수와 postgres 컨테이너 상태를 확인합니다.
