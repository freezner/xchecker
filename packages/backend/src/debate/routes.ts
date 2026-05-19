import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as sessionService from './session';
import * as documentService from './document';
import { DebateEngine, DebateEvent } from './engine';
import { FacilitatorRole } from './facilitator';
import { DebaterRole } from './debater';
import { IsolatedContext } from './context';
import { HarnessConfig } from './harness';
import { createProvider } from '../llm/registry';
import { getDecryptedKey } from '../api-keys/service';
import { getModelSettings } from '../user/service';
import { getDefaultLLMConfigOrThrow } from '../llm/defaults';

interface RealtimeSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: 'close', listener: () => void): void;
}

const SOCKET_OPEN = 1;

const HarnessSchema = z.object({
  maxRounds: z.number().int().min(1).max(20).optional(),
  maxTimeSeconds: z.number().int().min(30).max(3600).optional(),
  maxTokensPerTurn: z.number().int().min(100).max(16000).optional(),
  maxTotalTokens: z.number().int().min(1000).max(500000).optional(),
  stopOnConsensus: z.boolean().optional(),
});

export async function debateRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  // 토론 목록
  app.get('/', auth, async (req) => {
    const { userId } = req.user as { userId: string };
    return sessionService.listByUser(userId);
  });

  // 토론 생성
  app.post('/', auth, async (req, reply) => {
    const body = z
      .object({
        topic: z.string().min(1).max(500),
        description: z.string().max(5000).optional().default(''),
        harness: HarnessSchema.optional(),
      })
      .parse(req.body);

    const { userId } = req.user as { userId: string };
    const ms = await getModelSettings(userId);

    let facilitatorKeyId: string | null = ms.facilitatorKeyId;
    let debaterAKeyId: string | null = ms.debaterAKeyId;
    let debaterBKeyId: string | null = ms.debaterBKeyId;
    let facilitatorModel = ms.facilitatorModel;
    let debaterAModel = ms.debaterAModel;
    let debaterBModel = ms.debaterBModel;

    if (ms.apiMode === 'default') {
      const usedToday = await sessionService.countDefaultApiSessionsToday(userId);
      if (usedToday >= 2) {
        return reply.status(429).send({ error: '기본 제공 API는 하루에 2번까지만 토픽을 생성할 수 있습니다.' });
      }

      try {
        const defaults = getDefaultLLMConfigOrThrow();
        facilitatorKeyId = null;
        debaterAKeyId = null;
        debaterBKeyId = null;
        facilitatorModel = defaults.facilitatorModel;
        debaterAModel = defaults.debaterAModel;
        debaterBModel = defaults.debaterBModel;
      } catch (err) {
        return reply.status(500).send({ error: (err as Error).message });
      }
    } else if (!facilitatorKeyId || !debaterAKeyId || !debaterBKeyId || !facilitatorModel || !debaterAModel || !debaterBModel) {
      return reply.status(400).send({ error: '개별 API 사용 시 설정에서 API 키와 모델을 먼저 지정해주세요.' });
    }

    const session = await sessionService.create(
      userId,
      body.topic,
      body.description,
      body.harness ?? {},
      facilitatorKeyId,
      debaterAKeyId,
      debaterBKeyId,
      facilitatorModel,
      debaterAModel,
      debaterBModel,
    );
    return reply.status(201).send(session);
  });

  // 토론 상세
  app.get('/:id', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };
    const session = await sessionService.findById(id, userId);
    if (!session) return reply.status(404).send({ error: 'Not found' });

    const messages = await sessionService.getMessages(id);
    return { ...session, messages };
  });

  // 토론 삭제
  app.delete('/:id', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };
    const deleted = await sessionService.remove(id, userId);
    if (!deleted) return reply.status(404).send({ error: 'Not found' });
    return reply.status(204).send();
  });

  // 모델 설정 변경 (running/done 상태 제외)
  app.patch('/:id/models', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z
      .object({
        facilitatorKeyId: z.string().uuid(),
        debaterAKeyId: z.string().uuid(),
        debaterBKeyId: z.string().uuid(),
        facilitatorModel: z.string().min(1),
        debaterAModel: z.string().min(1),
        debaterBModel: z.string().min(1),
      })
      .parse(req.body);

    const { userId } = req.user as { userId: string };
    const updated = await sessionService.updateModels(
      id, userId,
      body.facilitatorKeyId, body.debaterAKeyId, body.debaterBKeyId,
      body.facilitatorModel, body.debaterAModel, body.debaterBModel,
    );

    if (!updated) return reply.status(400).send({ error: 'Cannot update a running or completed session' });

    const session = await sessionService.findById(id, userId);
    return session;
  });

  // 토론 강제 중단
  app.post('/:id/stop', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };
    const session = await sessionService.findById(id, userId);
    if (!session) return reply.status(404).send({ error: 'Not found' });

    await sessionService.updateState(id, 'stopped', { ended_at: new Date().toISOString() });
    return { ok: true };
  });

  // WebSocket: 실시간 토론 스트리밍
  app.get('/:id/ws', { websocket: true }, async (socket: RealtimeSocket, req) => {
    const send = (event: DebateEvent) => {
      if (socket.readyState === SOCKET_OPEN) {
        socket.send(JSON.stringify(event));
      }
    };

    try {
      await req.jwtVerify();
      const { userId } = req.user as { userId: string };
      const { id } = req.params as { id: string };
      console.log(`[ws] connect session=${id} user=${userId}`);

      const session = await sessionService.findById(id, userId);
      if (!session) {
        send({ type: 'error', content: 'Session not found' });
        socket.close();
        return;
      }

      // 완료된 세션만 재시작 불가, error 상태는 재시도 허용
      if (session.state === 'done') {
        send({ type: 'error', content: 'This session has already completed.' });
        socket.close();
        return;
      }

      // 재시작(stopped/error)이면 기존 메시지 삭제 후 새로 시작
      if (session.state === 'stopped' || session.state === 'error') {
        await sessionService.clearMessages(id);
      }

      await sessionService.updateState(id, 'running');

      // 문서 로드
      const documents = await documentService.listDocumentsWithContent(id);

      const defaults = session.facilitator_key_id ? null : getDefaultLLMConfigOrThrow();

      // API 키 복호화 (provider 타입 포함)
      const [facilitatorKey, debaterAKey, debaterBKey] = defaults
        ? [
            { provider: defaults.provider, apiKey: defaults.apiKey },
            { provider: defaults.provider, apiKey: defaults.apiKey },
            { provider: defaults.provider, apiKey: defaults.apiKey },
          ]
        : await Promise.all([
            getDecryptedKey(userId, session.facilitator_key_id as string),
            getDecryptedKey(userId, session.debater_a_key_id as string),
            getDecryptedKey(userId, session.debater_b_key_id as string),
          ]);

      const harness = session.harness_config as HarnessConfig;
      const context = new IsolatedContext();

      // 현재 스트리밍 중인 역할/라운드 추적
      let currentStreamRole: string | null = null;
      let currentRound = 0;

      const onChunk = (chunk: string) => {
        send({ type: 'chunk', role: currentStreamRole as DebateEvent['role'], round: currentRound, content: chunk });
      };

      const facilitatorProvider = createProvider(
        facilitatorKey.provider,
        facilitatorKey.apiKey,
        session.facilitator_model,
      );
      const debaterAProvider = createProvider(
        debaterAKey.provider,
        debaterAKey.apiKey,
        session.debater_a_model,
      );
      const debaterBProvider = createProvider(
        debaterBKey.provider,
        debaterBKey.apiKey,
        session.debater_b_model,
      );

      console.log(`[ws] providers ready: facilitator=${facilitatorKey.provider}/${session.facilitator_model}, A=${debaterAKey.provider}/${session.debater_a_model}, B=${debaterBKey.provider}/${session.debater_b_model}`);

      const description = session.description ?? '';
      const facilitator = new FacilitatorRole(facilitatorProvider, context, harness, onChunk, documents);
      const debaterA = new DebaterRole(debaterAProvider, 'A', context, harness, onChunk, documents, description);
      const debaterB = new DebaterRole(debaterBProvider, 'B', context, harness, onChunk, documents, description);

      const engine = new DebateEngine(
        session.topic,
        description,
        harness,
        facilitator,
        debaterA,
        debaterB,
        context,
        (event) => {
          // 완성된 메시지는 DB 저장
          if (event.type === 'message' || event.type === 'synthesis' || event.type === 'conclusion') {
            sessionService.saveMessage(
              id,
              event.round ?? 0,
              event.role ?? 'facilitator',
              event.content ?? '',
              0,
            );
          }

          // chunk 이벤트 직전에 role/round 추적
          if (event.type === 'chunk') {
            currentStreamRole = event.role ?? null;
            currentRound = event.round ?? 0;
          }

          if (event.type === 'harness_update') {
            sessionService.updateState(id, 'running', {
              round_current: event.round,
              token_total: event.tokenTotal,
            });
          }

          if (event.type === 'done') {
            sessionService.updateState(id, 'done', {
              token_total: event.tokenTotal,
              ended_at: new Date().toISOString(),
            });
          }

          if (event.type === 'error') {
            console.error(`[engine] error: ${event.content}`);
            sessionService.updateState(id, 'error', { ended_at: new Date().toISOString() });
          }

          if (event.type !== 'chunk') {
            console.log(`[engine] ${event.type} role=${event.role ?? '-'} round=${event.round ?? '-'}`);
          }

          send(event);
        },
        documents,
      );

      // 클라이언트 강제 종료 처리
      socket.on('close', () => {
        sessionService.updateState(id, 'stopped', { ended_at: new Date().toISOString() });
      });

      await engine.run();
    } catch (err) {
      console.error('[ws] fatal error:', err);
      send({ type: 'error', content: (err as Error).message });
      socket.close();
    }
  });
}
