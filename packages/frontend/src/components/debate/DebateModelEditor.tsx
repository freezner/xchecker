import React, { useState, useEffect } from 'react';
import { DebateSession, debateApi } from '../../api/debate';
import { userApi, ApiKeyRecord } from '../../api/user';
import { ModelSelector } from '../settings/ModelSelector';
import { Button } from '../ui/Button';

interface Props {
  session: DebateSession;
  onSaved: (updated: DebateSession) => void;
  onCancel: () => void;
}

export function DebateModelEditor({ session, onSaved, onCancel }: Props) {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [providers, setProviders] = useState<Record<string, string[]>>({});

  const [facilitatorKeyId, setFacilitatorKeyId] = useState(session.facilitator_key_id);
  const [debaterAKeyId, setDebaterAKeyId] = useState(session.debater_a_key_id);
  const [debaterBKeyId, setDebaterBKeyId] = useState(session.debater_b_key_id);
  const [facilitatorModel, setFacilitatorModel] = useState(session.facilitator_model);
  const [debaterAModel, setDebaterAModel] = useState(session.debater_a_model);
  const [debaterBModel, setDebaterBModel] = useState(session.debater_b_model);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([userApi.listApiKeys(), userApi.listProviders()]).then(([keys, p]) => {
      setApiKeys(keys);
      setProviders(p);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const updated = await debateApi.updateModels(session.id, {
        facilitatorKeyId,
        debaterAKeyId,
        debaterBKeyId,
        facilitatorModel,
        debaterAModel,
        debaterBModel,
      });
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const keyOptions = apiKeys.map((k) => (
    <option key={k.id} value={k.id}>{k.label} ({k.provider})</option>
  ));

  return (
    <form onSubmit={handleSave} className="model-editor">
      <h3>모델 설정 수정</h3>

      <ModelSelector
        label="진행자 (Facilitator)"
        keyOptions={keyOptions}
        keyId={facilitatorKeyId}
        model={facilitatorModel}
        onKeyChange={(id) => { setFacilitatorKeyId(id); setFacilitatorModel(''); }}
        onModelChange={setFacilitatorModel}
        providers={providers}
        apiKeys={apiKeys}
      />
      <ModelSelector
        label="토론자 A"
        keyOptions={keyOptions}
        keyId={debaterAKeyId}
        model={debaterAModel}
        onKeyChange={(id) => { setDebaterAKeyId(id); setDebaterAModel(''); }}
        onModelChange={setDebaterAModel}
        providers={providers}
        apiKeys={apiKeys}
      />
      <ModelSelector
        label="토론자 B"
        keyOptions={keyOptions}
        keyId={debaterBKeyId}
        model={debaterBModel}
        onKeyChange={(id) => { setDebaterBKeyId(id); setDebaterBModel(''); }}
        onModelChange={setDebaterBModel}
        providers={providers}
        apiKeys={apiKeys}
      />

      {error && <p className="error">{error}</p>}

      <div className="editor-actions">
        <Button type="submit" loading={loading}>저장</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>취소</Button>
      </div>
    </form>
  );
}
