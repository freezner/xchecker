import React from 'react';
import { ApiKeyRecord } from '../../api/user';

interface Props {
  label: string;
  keyOptions: React.ReactNode;
  keyId: string;
  model: string;
  onKeyChange: (id: string) => void;
  onModelChange: (model: string) => void;
  providers: Record<string, string[]>;
  apiKeys: ApiKeyRecord[];
}

export function ModelSelector({
  label, keyOptions, keyId, model,
  onKeyChange, onModelChange, providers, apiKeys,
}: Props) {
  const selectedKey = apiKeys.find((k) => k.id === keyId);
  const models = selectedKey ? (providers[selectedKey.provider] ?? []) : [];

  return (
    <div className="model-selector">
      <label>{label}</label>
      <div className="selector-row">
        <select value={keyId} onChange={(e) => { onKeyChange(e.target.value); onModelChange(''); }} required>
          <option value="">API 키 선택</option>
          {keyOptions}
        </select>
        <select value={model} onChange={(e) => onModelChange(e.target.value)} required disabled={!keyId}>
          <option value="">모델 선택</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
