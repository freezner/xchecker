import React, { useEffect, useRef, useState } from 'react';
import {
  documentApi,
  DebateDocument,
  readFileAsBase64,
  readFileAsText,
  formatBytes,
} from '../../api/document';
import { Button } from '../ui/Button';

const ALLOWED_TYPES: Record<string, string> = {
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

interface Props {
  sessionId: string;
  readonly?: boolean;
}

export function DocumentPanel({ sessionId, readonly = false }: Props) {
  const [docs, setDocs] = useState<DebateDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    documentApi.list(sessionId).then(setDocs).catch(() => {});
  }, [sessionId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const mimeType = file.type || 'text/plain';
        if (!ALLOWED_TYPES[mimeType]) {
          setError(`지원하지 않는 파일 형식: ${file.name}`);
          continue;
        }
        const content = await readFileAsBase64(file);

        const doc = await documentApi.upload(sessionId, {
          filename: file.name,
          mimeType,
          content,
        });
        setDocs((prev) => [...prev, doc]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await documentApi.delete(sessionId, docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="document-panel">
      <div className="document-panel-header">
        <h3>참고 문서</h3>
        <span className="doc-count">{docs.length}개</span>
      </div>

      {!readonly && (
        <div
          className="doc-dropzone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={Object.keys(ALLOWED_TYPES).join(',')}
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="dropzone-label">
            {uploading ? '업로드 중...' : '클릭 또는 드래그하여 파일 추가'}
          </span>
          <span className="dropzone-hint">
            txt, md, csv, json, pdf, xlsx, xls, docx, jpg, png, webp, gif · 최대 10MB
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {docs.length > 0 && (
        <ul className="doc-list">
          {docs.map((doc) => (
            <li key={doc.id} className="doc-item">
              <span className="doc-type-badge">{ALLOWED_TYPES[doc.mime_type] ?? doc.mime_type}</span>
              <span className="doc-filename">{doc.filename}</span>
              <span className="doc-size">{formatBytes(doc.size)}</span>
              {!readonly && (
                <button
                  className="doc-delete"
                  onClick={() => handleDelete(doc.id)}
                  title="삭제"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
