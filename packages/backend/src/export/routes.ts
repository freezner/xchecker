import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { findById, getMessages } from '../debate/session';
import { buildMarkdown } from './markdown';
import { markdownToDocx } from './docx';
import { buildHwpx } from './hwpx';
import { generateReport } from './report';
import { createProvider } from '../llm/registry';
import { getDecryptedKey } from '../api-keys/service';
import { getDefaultLLMConfigOrThrow } from '../llm/defaults';

function safeFilenameBase(topic: string): string {
  const name = topic
    .replace(/[\/\\?%*:|"<>]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return name || 'debate-report';
}

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function normalizeHeadingSpacing(md: string): string {
  return md.replace(/([^\n])\n(#{2,3}\s+)/g, '$1\n\n$2');
}

async function getReportMd(id: string, userId: string): Promise<{ md: string; filename: string } | null> {
  const session = await findById(id, userId);
  if (!session) return null;

  const messages = await getMessages(id);

  // Facilitator provider로 보고서 생성
  let md: string;
  try {
    const sessionWithKey = session as { facilitator_key_id: string | null; facilitator_model: string };
    const key = sessionWithKey.facilitator_key_id
      ? await getDecryptedKey(userId, sessionWithKey.facilitator_key_id)
      : (() => {
          const defaults = getDefaultLLMConfigOrThrow();
          return { provider: defaults.provider, apiKey: defaults.apiKey };
        })();
    const provider = createProvider(
      key.provider,
      key.apiKey,
      sessionWithKey.facilitator_model,
    );
    md = await generateReport(session as Parameters<typeof generateReport>[0], messages as Parameters<typeof generateReport>[1], provider);
  } catch {
    // LLM 실패 시 기존 Markdown으로 폴백
    md = buildMarkdown(session as Parameters<typeof buildMarkdown>[0], messages as Parameters<typeof buildMarkdown>[1]);
  }

  const slug = safeFilenameBase((session as { topic: string }).topic);
  return { md: normalizeHeadingSpacing(md), filename: slug };
}

export async function exportRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  app.get('/:id/export/md', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };

    const result = await getReportMd(id, userId);
    if (!result) return reply.status(404).send({ error: 'Not found' });

    reply.header('Content-Type', 'text/markdown; charset=utf-8');
    reply.header('Content-Disposition', contentDisposition(`report-${result.filename}.md`));
    return reply.send(result.md);
  });

  app.get('/:id/export/docx', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };

    const result = await getReportMd(id, userId);
    if (!result) return reply.status(404).send({ error: 'Not found' });

    const buf = await markdownToDocx(result.md);

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    reply.header('Content-Disposition', contentDisposition(`report-${result.filename}.docx`));
    return reply.send(buf);
  });

  app.get('/:id/export/hwpx', auth, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };

    const result = await getReportMd(id, userId);
    if (!result) return reply.status(404).send({ error: 'Not found' });

    const buf = await buildHwpx(result.md);

    reply.header('Content-Type', 'application/haansofthwpx');
    reply.header('Content-Disposition', contentDisposition(`report-${result.filename}.hwpx`));
    return reply.send(buf);
  });
}
