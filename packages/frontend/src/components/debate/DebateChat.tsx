import React, { useEffect, useRef } from 'react';
import { DebateEvent } from '../../hooks/useDebateSocket';
import { MarkdownText } from '../ui/MarkdownText';

const ROLE_CFG: Record<string, { label: string; avatar: string; accent: string }> = {
  facilitator: { label: '진행자',   avatar: '🎯', accent: '#22c55e' },
  debater_a:   { label: '토론자 A', avatar: 'A',  accent: '#6366f1' },
  debater_b:   { label: '토론자 B', avatar: 'B',  accent: '#ec4899' },
};

const TYPE_CFG: Record<string, { label: string; role: string }> = {
  synthesis:   { label: '진행자 합산', role: 'facilitator' },
  conclusion:  { label: '최종 결론',  role: 'facilitator' },
};

interface ChatMessageProps {
  role: string;
  label: string;
  content: string;
  round?: number;
  streaming?: boolean;
  typeLabel?: string;
}

function ChatMessage({ role, label, content, round, streaming, typeLabel }: ChatMessageProps) {
  const cfg = ROLE_CFG[role] ?? { label, avatar: '?', accent: '#888' };
  return (
    <div className={`chat-msg${streaming ? ' streaming' : ''}`} data-role={role}>
      <div className="chat-avatar" style={{ background: cfg.accent + '22', color: cfg.accent }}>
        {cfg.avatar}
      </div>
      <div className="chat-body">
        <div className="chat-meta-row">
          <span className="chat-name" style={{ color: cfg.accent }}>{typeLabel ?? cfg.label}</span>
          {round != null && round > 0 && <span className="chat-round">R{round}</span>}
        </div>
        <div className="chat-content">
          <MarkdownText content={content} />
          {streaming && <span className="cursor">|</span>}
        </div>
      </div>
    </div>
  );
}

function RoundDivider({ round }: { round: number }) {
  return (
    <div className="round-divider">
      <span>라운드 {round}</span>
    </div>
  );
}

function InfoBanner({ text }: { text: string }) {
  return <div className="chat-info-banner">{text}</div>;
}

interface Props {
  events: DebateEvent[];
  streaming: Record<string, string>;
}

export function DebateChat({ events, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length, Object.values(streaming).join('')]);

  const activeRole = Object.entries(streaming).find(([, v]) => v)?.[0];
  const activeChunk = activeRole ? streaming[activeRole] : '';

  return (
    <div className="chat-feed">
      {events.map((e, i) => {
        if (e.type === 'round_start' && e.round) {
          return <RoundDivider key={i} round={e.round} />;
        }
        if (e.type === 'message' && e.role && e.content) {
          return (
            <ChatMessage
              key={i}
              role={e.role}
              label={ROLE_CFG[e.role]?.label ?? e.role}
              content={e.content}
              round={e.round}
            />
          );
        }
        if ((e.type === 'synthesis' || e.type === 'conclusion') && e.content) {
          const cfg = TYPE_CFG[e.type];
          return (
            <ChatMessage
              key={i}
              role={cfg.role}
              label={cfg.label}
              typeLabel={cfg.label}
              content={e.content}
              round={e.type === 'synthesis' ? e.round : undefined}
            />
          );
        }
        if (e.type === 'consensus') {
          return <InfoBanner key={i} text="✅ 합의에 도달했습니다." />;
        }
        if (e.type === 'harness_stop' && e.reason) {
          return <InfoBanner key={i} text={`⏹ 토픽 검증 종료: ${e.reason}`} />;
        }
        if (e.type === 'error' && e.content) {
          return <InfoBanner key={i} text={`❌ 오류: ${e.content}`} />;
        }
        return null;
      })}

      {activeRole && activeChunk && (
        <ChatMessage
          role={activeRole}
          label={ROLE_CFG[activeRole]?.label ?? activeRole}
          content={activeChunk}
          streaming
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
