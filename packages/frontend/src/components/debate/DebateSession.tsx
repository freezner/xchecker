import React, { useEffect } from 'react';
import { DebateSession as SessionType, DebateMessage, debateApi } from '../../api/debate';
import { useDebateSocket, DebateEvent } from '../../hooks/useDebateSocket';
import { DebateChat } from './DebateChat';
import { HarnessStatus } from './HarnessStatus';
import { DocumentPanel } from './DocumentPanel';
import { Button } from '../ui/Button';

interface Props {
  session: SessionType;
  messages?: DebateMessage[];
  onSessionUpdate: (updated: SessionType) => void;
}

function toDebateEvents(messages: DebateMessage[]): DebateEvent[] {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const facilCountByRound: Record<number, number> = {};
  const events: DebateEvent[] = [];
  let lastRound = -1;

  for (const msg of sorted) {
    if (msg.round > 0 && msg.round !== lastRound) {
      lastRound = msg.round;
      events.push({ type: 'round_start', round: msg.round });
    }
    if (msg.role === 'facilitator') {
      if (msg.round === 0) {
        events.push({ type: 'conclusion', role: 'facilitator', round: 0, content: msg.content });
      } else {
        const cnt = facilCountByRound[msg.round] ?? 0;
        facilCountByRound[msg.round] = cnt + 1;
        events.push({
          type: cnt === 0 ? 'message' : 'synthesis',
          role: 'facilitator',
          round: msg.round,
          content: msg.content,
        });
      }
    } else {
      events.push({
        type: 'message',
        role: msg.role as DebateEvent['role'],
        round: msg.round,
        content: msg.content,
      });
    }
  }
  return events;
}

const MODEL_ROLES = [
  { key: 'facilitator_model', label: '진행자', accent: '#22c55e', avatar: '🎯' },
  { key: 'debater_a_model',   label: '토론자 A', accent: '#6366f1', avatar: 'A' },
  { key: 'debater_b_model',   label: '토론자 B', accent: '#ec4899', avatar: 'B' },
] as const;

export function DebateSession({ session, messages, onSessionUpdate }: Props) {
  const isDone = session.state === 'done';
  const isRestartable = session.state === 'stopped' || session.state === 'error';
  const initialStatus = isDone ? 'done' : isRestartable ? 'stopped' : 'idle';
  const initialEvents = messages ? toDebateEvents(messages) : [];
  const { state, connect, disconnect } = useDebateSocket(session.id, initialStatus, initialEvents);

  useEffect(() => {
    if (session.state === 'running') connect();
  }, []);

  const handleStop = async () => {
    disconnect();
    await debateApi.stop(session.id);
  };

  const hasDocs = true; // always show doc panel
  const showRightSidebar = state.status === 'done' || state.status === 'stopped';

  return (
    <div className={`debate-app${showRightSidebar ? ' has-right' : ''}`}>

      {/* ── 좌측 사이드바 ── */}
      <aside className="debate-left">

        <div className="sidebar-topic">
          <h2 className="sidebar-title">{session.topic}</h2>
          {session.description && (
            <p className="sidebar-description">{session.description}</p>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">참석자</div>
          {MODEL_ROLES.map(({ key, label, accent, avatar }) => (
            <div key={key} className="participant-row">
              <span className="participant-avatar" style={{ background: accent + '22', color: accent }}>
                {avatar}
              </span>
              <div className="participant-info">
                <span className="participant-label">{label}</span>
                <span className="participant-model">{session[key] || '—'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">진행 현황</div>
          <HarnessStatus
            config={session.harness_config}
            round={state.round}
            tokenTotal={state.tokenTotal}
            status={state.status}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">참고 자료</div>
          <DocumentPanel
            sessionId={session.id}
            readonly={state.status === 'running' || isDone}
          />
        </div>

        <div className="sidebar-actions">
          {state.status === 'idle' && (
            <Button onClick={() => connect()}>검증 시작</Button>
          )}
          {state.status === 'running' && (
            <Button variant="danger" onClick={handleStop}>중단</Button>
          )}
          {(state.status === 'stopped' || state.status === 'error') && (
            <Button onClick={() => connect(true)}>다시 시작</Button>
          )}
        </div>
      </aside>

      {/* ── 메인 채팅 영역 ── */}
      <main className="debate-main">
        {state.events.length === 0 && state.status === 'idle' && (
          <div className="chat-empty">
            <p>검증 시작 버튼을 눌러 토픽 검증을 시작하세요.</p>
          </div>
        )}
        <DebateChat events={state.events} streaming={state.streaming} />
      </main>

      {/* ── 우측 사이드바 (완료 시) ── */}
      {showRightSidebar && (
        <aside className="debate-right">
          <div className="sidebar-section-label">결과 보고서</div>
          <p className="report-desc">토픽 검증 내용을 AI가 보고서 형식으로 정리합니다.</p>
          <div className="report-links">
            <a href={debateApi.exportMd(session.id)} download className="report-link">
              <span className="report-icon">📄</span>
              <div>
                <div className="report-link-title">Markdown</div>
                <div className="report-link-sub">.md</div>
              </div>
            </a>
            <a href={debateApi.exportDocx(session.id)} download className="report-link">
              <span className="report-icon">📝</span>
              <div>
                <div className="report-link-title">Word 문서</div>
                <div className="report-link-sub">.docx</div>
              </div>
            </a>
            <a href={debateApi.exportHwpx(session.id)} download className="report-link">
              <span className="report-icon">📋</span>
              <div>
                <div className="report-link-title">한글 문서</div>
                <div className="report-link-sub">.hwpx</div>
              </div>
            </a>
          </div>
        </aside>
      )}
    </div>
  );
}
