import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { debateApi, HarnessConfig } from '../../api/debate';
import { documentApi, readFileAsBase64, formatBytes } from '../../api/document';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const ALLOWED_MIME: Record<string, string> = {
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/csv': 'CSV',
  'application/json': 'JSON',
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

export function DebateSetup() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [harness, setHarness] = useState<HarnessConfig>({
    maxRounds: 5,
    maxTimeSeconds: 600,
    maxTokensPerTurn: 4000,
    maxTotalTokens: 100000,
    stopOnConsensus: true,
  });

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [harnessOpen, setHarnessOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');

  // 파일 추가
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter((f) => {
      const mime = f.type || 'text/plain';
      return ALLOWED_MIME[mime];
    });
    setPendingFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) =>
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i));

  // URL 추가
  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch { setError('올바른 URL 형식이 아닙니다.'); return; }
    if (!pendingUrls.includes(url)) setPendingUrls((prev) => [...prev, url]);
    setUrlInput('');
    setError('');
  };

  const removeUrl = (i: number) =>
    setPendingUrls((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await debateApi.create({ topic, description, harness });

      // 파일 업로드
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        setUploadStatus(`파일 업로드 중 (${i + 1}/${pendingFiles.length}): ${file.name}`);
        const mime = file.type || 'text/plain';
        const content = await readFileAsBase64(file);
        await documentApi.upload(session.id, { filename: file.name, mimeType: mime, content });
      }

      // URL fetch
      for (let i = 0; i < pendingUrls.length; i++) {
        const url = pendingUrls[i];
        setUploadStatus(`웹 링크 가져오는 중 (${i + 1}/${pendingUrls.length}): ${url}`);
        await documentApi.fetchUrl(session.id, url);
      }

      navigate(`/debates/${session.id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
      setUploadStatus('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="setup-form">
      <h2>새 토픽 만들기</h2>

      <Input
        label="토픽"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="검증할 주제를 입력하세요"
        required
      />

      <div className="field">
        <label className="field-label">배경 설명 (선택)</label>
        <textarea
          className="field-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="토픽에 참고될 배경 정보, 맥락, 전제 조건 등을 자유롭게 입력하세요"
          rows={4}
          maxLength={5000}
        />
        <span className="field-hint">{description.length} / 5000</span>
      </div>

      {/* 참고 자료 */}
      <section className="setup-section">
        <button
          type="button"
          className="setup-accordion-header"
          aria-expanded={resourcesOpen}
          onClick={() => setResourcesOpen((v) => !v)}
        >
          <span>
            <strong>참고 자료</strong>
            <small>선택 · 파일 {pendingFiles.length}개 · 링크 {pendingUrls.length}개</small>
          </span>
          <span className="accordion-chevron">{resourcesOpen ? '접기' : '펼치기'}</span>
        </button>

        {resourcesOpen && (
          <div className="setup-accordion-body">
            {/* 파일 업로드 */}
            <div className="resource-sub">
              <label className="field-label">파일</label>
              <div
                className="doc-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={Object.keys(ALLOWED_MIME).join(',')}
                  style={{ display: 'none' }}
                  onChange={(e) => addFiles(e.target.files)}
                />
                <span className="dropzone-label">클릭 또는 드래그하여 파일 추가</span>
                <span className="dropzone-hint">txt, md, csv, json, pdf, xlsx, xls, docx, jpg, png, webp, gif · 최대 10MB</span>
              </div>
              {pendingFiles.length > 0 && (
                <ul className="doc-list">
                  {pendingFiles.map((f, i) => (
                    <li key={i} className="doc-item">
                      <span className="doc-type-badge">{ALLOWED_MIME[f.type] ?? 'FILE'}</span>
                      <span className="doc-filename">{f.name}</span>
                      <span className="doc-size">{formatBytes(f.size)}</span>
                      <button type="button" className="doc-delete" onClick={() => removeFile(i)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 웹 링크 */}
            <div className="resource-sub">
              <label className="field-label">웹 링크</label>
              <div className="url-input-row">
                <input
                  className="url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                />
                <Button type="button" variant="secondary" onClick={addUrl}>추가</Button>
              </div>
              {pendingUrls.length > 0 && (
                <ul className="doc-list">
                  {pendingUrls.map((url, i) => (
                    <li key={i} className="doc-item">
                      <span className="doc-type-badge">URL</span>
                      <span className="doc-filename">{url}</span>
                      <button type="button" className="doc-delete" onClick={() => removeUrl(i)}>×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="setup-section">
        <button
          type="button"
          className="setup-accordion-header"
          aria-expanded={harnessOpen}
          onClick={() => setHarnessOpen((v) => !v)}
        >
          <span>
            <strong>하네스 설정</strong>
            <small>{harness.maxRounds}라운드 · {harness.maxTimeSeconds}초 · {harness.maxTotalTokens?.toLocaleString()}토큰</small>
          </span>
          <span className="accordion-chevron">{harnessOpen ? '접기' : '펼치기'}</span>
        </button>

        {harnessOpen && (
          <div className="setup-accordion-body">
            <div className="harness-grid">
              <Input label="최대 라운드" type="number" value={harness.maxRounds} min={1} max={20}
                onChange={(e) => setHarness((h) => ({ ...h, maxRounds: Number(e.target.value) }))} />
              <Input label="최대 시간(초)" type="number" value={harness.maxTimeSeconds} min={30}
                onChange={(e) => setHarness((h) => ({ ...h, maxTimeSeconds: Number(e.target.value) }))} />
              <Input label="턴당 최대 토큰" type="number" value={harness.maxTokensPerTurn} min={100}
                onChange={(e) => setHarness((h) => ({ ...h, maxTokensPerTurn: Number(e.target.value) }))} />
              <Input label="전체 최대 토큰" type="number" value={harness.maxTotalTokens} min={1000}
                onChange={(e) => setHarness((h) => ({ ...h, maxTotalTokens: Number(e.target.value) }))} />
            </div>
            <label className="checkbox-label">
              <input type="checkbox" checked={harness.stopOnConsensus}
                onChange={(e) => setHarness((h) => ({ ...h, stopOnConsensus: e.target.checked }))} />
              합의 도달 시 조기 종료
            </label>
          </div>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {uploadStatus && <p className="upload-status">{uploadStatus}</p>}
      <Button type="submit" loading={loading}>토픽 생성</Button>
    </form>
  );
}
