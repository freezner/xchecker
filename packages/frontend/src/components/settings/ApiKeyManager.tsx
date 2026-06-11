import React, { useState, useEffect, useRef } from 'react';
import { userApi, ApiKeyRecord } from '../../api/user';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const PROVIDERS = ['openai', 'anthropic', 'google'] as const;

function EditableLabel({ keyId, initialLabel, onSaved }: {
  keyId: string;
  initialLabel: string;
  onSaved: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialLabel);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === initialLabel) {
      setValue(initialLabel);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await userApi.updateApiKeyLabel(keyId, trimmed);
      onSaved(trimmed);
      setEditing(false);
    } catch {
      setValue(initialLabel);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { setValue(initialLabel); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="key-label-input"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        maxLength={50}
      />
    );
  }

  return (
    <button className="key-label-btn" onClick={startEdit} title="클릭해서 레이블 수정">
      {value}
      <span className="key-label-edit-icon">✏️</span>
    </button>
  );
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [apiMode, setApiMode] = useState<'default' | 'custom'>('default');
  const [provider, setProvider] = useState<string>('openai');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => userApi.listApiKeys().then(setKeys);
  useEffect(() => {
    Promise.all([load(), userApi.getModelSettings()])
      .then(([, settings]) => setApiMode(settings.apiMode));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await userApi.addApiKey(provider, label, apiKey);
      setLabel('');
      setApiKey('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 API 키를 삭제하시겠습니까?')) return;
    await userApi.deleteApiKey(id);
    await load();
  };

  const handleLabelSaved = (id: string, newLabel: string) => {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, label: newLabel } : k));
  };

  return (
    <div className="settings-card api-key-card">
      <div className="settings-card-header">
        <h3>API 키 관리</h3>
        <p className="settings-card-desc">LLM 프로바이더별 API 키를 등록하세요</p>
      </div>
      <div className="settings-card-body">
        {apiMode === 'default' && (
          <div className="api-key-disabled-message">
            <strong>현재 기본 제공 모드입니다.</strong>
            <span>API 키를 미리 등록해두고, 모델 설정에서 개별 API로 전환하면 사용됩니다.</span>
          </div>
        )}

        <form onSubmit={handleAdd} className="add-key-form">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Input placeholder="레이블 (예: My OpenAI Key)" value={label}
            onChange={(e) => setLabel(e.target.value)} required />
          <Input placeholder="API 키" value={apiKey} type="password"
            onChange={(e) => setApiKey(e.target.value)} required />
          <Button type="submit" loading={loading}>추가</Button>
        </form>

        {error && <p className="error">{error}</p>}

        <ul className="key-list">
          {keys.map((k) => (
            <li key={k.id}>
              <span className="key-provider">{k.provider}</span>
              <EditableLabel
                keyId={k.id}
                initialLabel={k.label}
                onSaved={(newLabel) => handleLabelSaved(k.id, newLabel)}
              />
              <span className="key-date">{new Date(k.created_at).toLocaleDateString('ko-KR')}</span>
              <Button variant="danger" onClick={() => handleDelete(k.id)}>삭제</Button>
            </li>
          ))}
          {keys.length === 0 && <li className="empty">등록된 API 키가 없습니다.</li>}
        </ul>
      </div>
    </div>
  );
}
