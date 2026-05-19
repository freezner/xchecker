import React, { useEffect, useState } from 'react';
import { userApi, ApiKeyRecord, ModelSettings } from '../../api/user';
import { ModelSelector } from './ModelSelector';
import { Button } from '../ui/Button';

const EMPTY: ModelSettings = {
  apiMode: 'default',
  facilitatorKeyId: '', facilitatorModel: '',
  debaterAKeyId: '', debaterAModel: '',
  debaterBKeyId: '', debaterBModel: '',
};

export function ModelSettingsManager() {
  const [settings, setSettings] = useState<ModelSettings>(EMPTY);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [providers, setProviders] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      userApi.listApiKeys(),
      userApi.listProviders(),
      userApi.getModelSettings(),
    ]).then(([keys, p, ms]) => {
      setApiKeys(keys);
      setProviders(p);
      setSettings(ms);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);
    try {
      await userApi.saveModelSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
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
    <form onSubmit={handleSave} className="settings-card">
      <div className="settings-card-header">
        <h3>모델 설정</h3>
        <p className="settings-card-desc">토픽 생성 시 자동으로 사용될 역할별 기본 모델</p>
      </div>
      <div className="settings-card-body">
        <div className="api-mode-options">
          <label className="api-mode-option">
            <input
              type="radio"
              name="apiMode"
              value="default"
              checked={settings.apiMode === 'default'}
              onChange={() => setSettings((s) => ({ ...s, apiMode: 'default' }))}
            />
            <span>
              <strong>기본 제공</strong>
              <small>API 키 입력 없이 공통 모델을 사용합니다. 하루 2회 토픽 생성 제한이 있습니다.</small>
            </span>
          </label>
          <label className="api-mode-option">
            <input
              type="radio"
              name="apiMode"
              value="custom"
              checked={settings.apiMode === 'custom'}
              onChange={() => setSettings((s) => ({ ...s, apiMode: 'custom' }))}
            />
            <span>
              <strong>개별 API</strong>
              <small>직접 등록한 LLM API 키와 모델을 사용하며 생성 횟수 제한이 없습니다.</small>
            </span>
          </label>
        </div>

        {settings.apiMode === 'custom' && (
          <>
            <ModelSelector
              label="진행자 (Facilitator)"
              keyOptions={keyOptions}
              keyId={settings.facilitatorKeyId}
              model={settings.facilitatorModel}
              onKeyChange={(id) => setSettings((s) => ({ ...s, facilitatorKeyId: id, facilitatorModel: '' }))}
              onModelChange={(m) => setSettings((s) => ({ ...s, facilitatorModel: m }))}
              providers={providers}
              apiKeys={apiKeys}
            />
            <ModelSelector
              label="토론자 A"
              keyOptions={keyOptions}
              keyId={settings.debaterAKeyId}
              model={settings.debaterAModel}
              onKeyChange={(id) => setSettings((s) => ({ ...s, debaterAKeyId: id, debaterAModel: '' }))}
              onModelChange={(m) => setSettings((s) => ({ ...s, debaterAModel: m }))}
              providers={providers}
              apiKeys={apiKeys}
            />
            <ModelSelector
              label="토론자 B"
              keyOptions={keyOptions}
              keyId={settings.debaterBKeyId}
              model={settings.debaterBModel}
              onKeyChange={(id) => setSettings((s) => ({ ...s, debaterBKeyId: id, debaterBModel: '' }))}
              onModelChange={(m) => setSettings((s) => ({ ...s, debaterBModel: m }))}
              providers={providers}
              apiKeys={apiKeys}
            />
          </>
        )}

        {error && <p className="error">{error}</p>}
        {saved && <p className="success">저장됐습니다.</p>}

        <div><Button type="submit" loading={loading}>저장</Button></div>
      </div>
    </form>
  );
}
