import { z } from 'zod';

const optionalEnv = z.preprocess((v) => v === '' ? undefined : v, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64), // 32바이트 hex
  RP_NAME: z.string().default('xchecker'),
  RP_ID: z.string().default('localhost'),
  ORIGIN: z.string().default('http://localhost:3000').transform((v) =>
    v.includes(',') ? v.split(',').map((s) => s.trim()) : v
  ),
  DEFAULT_LLM_PROVIDER: z.preprocess((v) => v === '' ? undefined : v, z.enum(['openai', 'anthropic', 'google']).optional()),
  DEFAULT_LLM_API_KEY: optionalEnv,
  DEFAULT_FACILITATOR_MODEL: optionalEnv,
  DEFAULT_DEBATER_A_MODEL: optionalEnv,
  DEFAULT_DEBATER_B_MODEL: optionalEnv,
});

export const config = envSchema.parse(process.env);
