import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as apiKeyService from './service';

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'google'] as const;

export async function apiKeyRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  app.get('/api-keys', auth, async (req) => {
    const { userId } = req.user as { userId: string };
    return apiKeyService.list(userId);
  });

  app.post('/api-keys', auth, async (req, reply) => {
    const { provider, label, apiKey } = z
      .object({
        provider: z.enum(SUPPORTED_PROVIDERS),
        label: z.string().min(1).max(50),
        apiKey: z.string().min(1),
      })
      .parse(req.body);

    const { userId } = req.user as { userId: string };
    const record = await apiKeyService.create(userId, provider, label, apiKey);
    return reply.status(201).send(record);
  });

  app.patch('/api-keys/:id', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { label } = z.object({ label: z.string().min(1).max(50) }).parse(req.body);
    const { userId } = req.user as { userId: string };
    const record = await apiKeyService.updateLabel(userId, id, label);
    return reply.send(record);
  });

  app.delete('/api-keys/:id', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };
    await apiKeyService.remove(userId, id);
    return reply.status(204).send();
  });
}
