import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import { api } from './client';

export async function register(displayName: string) {
  const { tempId, options } = await api.post<{ tempId: string; options: unknown }>(
    '/api/auth/register/begin',
    { displayName },
  );

  const credential = await startRegistration(options as Parameters<typeof startRegistration>[0]);

  await api.post('/api/auth/register/finish', { tempId, credential });
}

export async function login() {
  const { tempId, options } = await api.post<{ tempId: string; options: unknown }>(
    '/api/auth/login/begin',
    {},
  );

  const authResponse = await startAuthentication(
    options as Parameters<typeof startAuthentication>[0],
  );

  await api.post('/api/auth/login/finish', { tempId, authResponse });
}

export async function logout() {
  await api.delete('/api/auth/logout');
}
