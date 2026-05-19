import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { ApiKeyManager } from '../components/settings/ApiKeyManager';
import { ModelSettingsManager } from '../components/settings/ModelSettingsManager';

const NAV_ITEMS = [
  { id: 'models', label: '모델 설정', icon: '🤖', desc: '역할별 기본 모델 지정' },
  { id: 'apikeys', label: 'API 키',   icon: '🔑', desc: 'LLM 프로바이더 키 관리' },
] as const;

type SectionId = typeof NAV_ITEMS[number]['id'];

export function SettingsPage() {
  useAuth();
  const [active, setActive] = useState<SectionId>('models');

  return (
    <Layout>
      <div className="settings-layout">
        <nav className="settings-nav">
          <div className="settings-nav-title">설정</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item${active === item.id ? ' active' : ''}`}
              onClick={() => setActive(item.id)}
            >
              <span className="settings-nav-icon">{item.icon}</span>
              <div className="settings-nav-text">
                <span className="settings-nav-label">{item.label}</span>
                <span className="settings-nav-desc">{item.desc}</span>
              </div>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {active === 'models' && <ModelSettingsManager />}
          {active === 'apikeys' && <ApiKeyManager />}
        </div>
      </div>
    </Layout>
  );
}
