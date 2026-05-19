import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { db } from '../db/client';
import { config } from '../config';

// 챌린지는 단기 임시 저장 (5분 TTL)
interface PendingChallenge {
  challenge: string;
  displayName?: string;
  expiresAt: number;
}
const pendingChallenges = new Map<string, PendingChallenge>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingChallenges) {
    if (val.expiresAt < now) pendingChallenges.delete(key);
  }
}, 60_000);

export async function beginRegistration(displayName: string) {
  const tempId = crypto.randomUUID();

  const options = await generateRegistrationOptions({
    rpName: config.RP_NAME,
    rpID: config.RP_ID,
    userID: tempId,
    userName: displayName,
    userDisplayName: displayName,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  pendingChallenges.set(tempId, {
    challenge: options.challenge,
    displayName,
    expiresAt: Date.now() + 5 * 60_000,
  });

  return { tempId, options };
}

export async function finishRegistration(tempId: string, credential: unknown) {
  const pending = pendingChallenges.get(tempId);
  if (!pending?.displayName) throw new Error('Invalid or expired challenge');
  pendingChallenges.delete(tempId);

  const verification = await verifyRegistrationResponse({
    response: credential as Parameters<typeof verifyRegistrationResponse>[0]['response'],
    expectedChallenge: pending.challenge,
    expectedOrigin: config.ORIGIN,
    expectedRPID: config.RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  // v9.0.3 API: registrationInfo.credentialID (Uint8Array), credentialPublicKey (Uint8Array)
  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo as {
    credentialID: Uint8Array;
    credentialPublicKey: Uint8Array;
    counter: number;
  };

  const credentialIdB64 = isoBase64URL.fromBuffer(credentialID);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (display_name) VALUES ($1) RETURNING id`,
    [pending.displayName],
  );
  const userId = rows[0].id;

  await db.query(
    `INSERT INTO passkey_credentials (user_id, credential_id, public_key, sign_count)
     VALUES ($1, $2, $3, $4)`,
    [userId, credentialIdB64, Buffer.from(credentialPublicKey), counter],
  );

  return userId;
}

export async function beginLogin() {
  const tempId = crypto.randomUUID();

  const options = await generateAuthenticationOptions({
    rpID: config.RP_ID,
    userVerification: 'preferred',
  });

  pendingChallenges.set(tempId, {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60_000,
  });

  return { tempId, options };
}

export async function finishLogin(tempId: string, authResponse: unknown) {
  const pending = pendingChallenges.get(tempId);
  if (!pending) throw new Error('Invalid or expired challenge');
  pendingChallenges.delete(tempId);

  const resp = authResponse as { id: string };
  const { rows } = await db.query<{
    id: string;
    user_id: string;
    public_key: Buffer;
    sign_count: string;
  }>(
    `SELECT id, user_id, public_key, sign_count FROM passkey_credentials WHERE credential_id = $1`,
    [resp.id],
  );
  if (!rows[0]) throw new Error('Unknown credential');

  const storedCred = rows[0];

  // v9.0.3 API: authenticator 파라미터 사용 (credential 아님)
  const verification = await verifyAuthenticationResponse({
    response: authResponse as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge: pending.challenge,
    expectedOrigin: config.ORIGIN,
    expectedRPID: config.RP_ID,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(resp.id),
      credentialPublicKey: new Uint8Array(storedCred.public_key),
      counter: Number(storedCred.sign_count),
    },
  } as Parameters<typeof verifyAuthenticationResponse>[0]);

  if (!verification.verified) throw new Error('Authentication verification failed');

  await db.query(`UPDATE passkey_credentials SET sign_count = $1 WHERE id = $2`, [
    verification.authenticationInfo.newCounter,
    storedCred.id,
  ]);

  return storedCred.user_id;
}
