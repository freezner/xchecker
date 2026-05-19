import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as userService from './service';

export async function userRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  app.get('/me', auth, async (req, reply) => {
    const { userId } = req.user as { userId: string };
    const user = await userService.findById(userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  app.get('/model-settings', auth, async (req) => {
    const { userId } = req.user as { userId: string };
    return userService.getModelSettings(userId);
  });

  app.put('/model-settings', auth, async (req) => {
    const { userId } = req.user as { userId: string };
    const body = z.object({
      apiMode: z.enum(['default', 'custom']).default('default'),
      facilitatorKeyId: z.string(),
      facilitatorModel: z.string(),
      debaterAKeyId: z.string(),
      debaterAModel: z.string(),
      debaterBKeyId: z.string(),
      debaterBModel: z.string(),
    }).parse(req.body);
    await userService.saveModelSettings(userId, body);
    return body;
  });
}
