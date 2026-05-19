import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import { config } from './config';
import { runMigrations } from './db/migrate';
import { authRoutes } from './auth/routes';
import { userRoutes } from './user/routes';
import { apiKeyRoutes } from './api-keys/routes';
import { debateRoutes } from './debate/routes';
import { documentRoutes } from './debate/document_routes';
import { exportRoutes } from './export/routes';
import { PROVIDER_MODELS } from './llm/registry';

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 }); // 20MB

async function start() {
  await app.register(fastifyCors, {
    origin: config.ORIGIN,
    credentials: true,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: 'token', signed: false },
  });

  await app.register(fastifyWebsocket);

  // 인증 데코레이터
  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // 라우트 등록
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(apiKeyRoutes, { prefix: '/api/user' });
  await app.register(debateRoutes, { prefix: '/api/debates' });
  await app.register(documentRoutes, { prefix: '/api/debates' });
  await app.register(exportRoutes, { prefix: '/api/debates' });

  // 프론트엔드 참고용: 지원 프로바이더 목록
  app.get('/api/providers', async () => PROVIDER_MODELS);

  // 헬스체크
  app.get('/api/health', async () => ({ ok: true }));

  await runMigrations();
  await app.listen({ port: Number(config.PORT), host: '0.0.0.0' });
  console.log(`[server] listening on port ${config.PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
