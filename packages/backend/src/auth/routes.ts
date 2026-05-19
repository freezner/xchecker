import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as authService from './service';

export async function authRoutes(app: FastifyInstance) {
  // Passkey 등록 시작
  app.post('/register/begin', async (req, reply) => {
    const { displayName } = z.object({ displayName: z.string().min(1).max(50) }).parse(req.body);
    const result = await authService.beginRegistration(displayName);
    return result;
  });

  // Passkey 등록 완료
  app.post('/register/finish', async (req, reply) => {
    const { tempId, credential } = z
      .object({ tempId: z.string(), credential: z.unknown() })
      .parse(req.body);

    const userId = await authService.finishRegistration(tempId, credential);
    const token = app.jwt.sign({ userId }, { expiresIn: '24h' });

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return { ok: true };
  });

  // Passkey 로그인 시작
  app.post('/login/begin', async () => {
    return authService.beginLogin();
  });

  // Passkey 로그인 완료
  app.post('/login/finish', async (req, reply) => {
    const { tempId, authResponse } = z
      .object({ tempId: z.string(), authResponse: z.unknown() })
      .parse(req.body);

    const userId = await authService.finishLogin(tempId, authResponse);
    const token = app.jwt.sign({ userId }, { expiresIn: '24h' });

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return { ok: true };
  });

  // 로그아웃
  app.delete('/logout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });
}
