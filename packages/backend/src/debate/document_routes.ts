import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as documentService from './document';
import * as sessionService from './session';
import { parseExcel, parseDocx, parsePdf } from './parsers';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB decoded

const ALLOWED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Office formats (parsed to text on upload)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf',
]);

// MIME types that need server-side parsing → stored as text/plain
type ParseType = 'excel' | 'docx' | 'pdf';
const PARSE_MIME: Record<string, ParseType> = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/pdf': 'pdf',
};

export async function documentRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] };

  // 문서 목록
  app.get('/:sessionId/documents', auth, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };
    return documentService.listDocuments(sessionId, userId);
  });

  // 문서 업로드 (base64 JSON body)
  app.post('/:sessionId/documents', auth, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };

    const session = await sessionService.findById(sessionId, userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.state === 'running') {
      return reply.status(400).send({ error: 'Cannot upload documents while debate is running' });
    }

    const body = z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.string(),
      content: z.string().min(1), // base64 or raw text
    }).parse(req.body);

    if (!ALLOWED_MIME.has(body.mimeType)) {
      return reply.status(400).send({ error: `Unsupported file type: ${body.mimeType}` });
    }

    const isImage = body.mimeType.startsWith('image/');
    const parseType = PARSE_MIME[body.mimeType] as ParseType | undefined;
    const decoded = Buffer.from(body.content, 'base64');

    if (decoded.length > MAX_SIZE) {
      return reply.status(400).send({ error: 'File too large (max 10MB)' });
    }

    let storedContent = body.content;
    let storedMime = body.mimeType;

    try {
      if (parseType === 'excel') {
        const text = await parseExcel(decoded);
        storedContent = text;
        storedMime = 'text/plain';
      } else if (parseType === 'docx') {
        const text = await parseDocx(decoded);
        storedContent = text;
        storedMime = 'text/plain';
      } else if (parseType === 'pdf') {
        const text = await parsePdf(decoded);
        if (!text.trim()) {
          return reply.status(400).send({ error: 'PDF에서 텍스트를 추출할 수 없습니다. 스캔 이미지 기반 PDF는 지원하지 않습니다.' });
        }
        storedContent = text;
        storedMime = 'text/plain';
      } else if (!isImage) {
        // plain text variants: send as UTF-8 text, not base64
        storedContent = decoded.toString('utf8');
      }
    } catch (err) {
      return reply.status(400).send({
        error: `파일을 파싱할 수 없습니다: ${(err as Error).message}`,
      });
    }

    const size = parseType
      ? Buffer.byteLength(storedContent, 'utf8')
      : decoded.length;

    const doc = await documentService.createDocument(
      sessionId, userId,
      body.filename, storedMime, size, storedContent,
    );
    return reply.status(201).send(doc);
  });

  // 웹 링크 가져오기
  app.post('/:sessionId/documents/fetch', auth, async (req, reply) => {
    const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(req.params);
    const { userId } = req.user as { userId: string };

    const session = await sessionService.findById(sessionId, userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    if (session.state === 'running') {
      return reply.status(400).send({ error: 'Cannot add documents while debate is running' });
    }

    const { url } = z.object({ url: z.string().url() }).parse(req.body);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; xchecker-bot/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      return reply.status(400).send({ error: `URL을 가져올 수 없습니다: ${(err as Error).message}` });
    }

    if (!res.ok) {
      return reply.status(400).send({ error: `URL 응답 오류: HTTP ${res.status}` });
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/') && !contentType.includes('application/json')) {
      return reply.status(400).send({ error: '텍스트 또는 HTML 형식의 URL만 지원합니다.' });
    }

    const raw = await res.text();
    let content: string;

    if (contentType.includes('text/html')) {
      content = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else {
      content = raw.trim();
    }

    // 최대 200KB 텍스트만 저장
    if (Buffer.byteLength(content, 'utf8') > 200 * 1024) {
      content = content.slice(0, 200 * 1024);
    }

    const hostname = new URL(url).hostname;
    const filename = `${hostname}.txt`;

    const doc = await documentService.createDocument(
      sessionId, userId, filename, 'text/plain',
      Buffer.byteLength(content, 'utf8'), content,
    );
    return reply.status(201).send(doc);
  });

  // 문서 삭제
  app.delete('/:sessionId/documents/:docId', auth, async (req, reply) => {
    const { sessionId, docId } = z.object({
      sessionId: z.string().uuid(),
      docId: z.string().uuid(),
    }).parse(req.params);
    const { userId } = req.user as { userId: string };

    // Verify session ownership
    const session = await sessionService.findById(sessionId, userId);
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    const deleted = await documentService.deleteDocument(docId, userId);
    if (!deleted) return reply.status(404).send({ error: 'Document not found' });
    return reply.status(204).send();
  });
}
