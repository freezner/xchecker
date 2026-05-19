import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { debateApi, DebateSession } from '../api/debate';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/Button';

const STATE_LABELS: Record<string, string> = {
  idle: '대기',
  running: '진행 중',
  done: '완료',
  stopped: '중단됨',
  error: '오류',
};

const STATE_ORDER = ['running', 'idle', 'done', 'stopped', 'error'] as const;
const FILTER_STATES = ['all', ...STATE_ORDER] as const;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(value: string) {
  if (!value) return '날짜 선택';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function DatePicker({ value, onChange }: {
  value: string;
  onChange: (value: string) => void;
}) {
  const initial = value ? new Date(`${value}T00:00:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const todayKey = toDateKey(new Date());

  const moveMonth = (delta: number) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const selectDate = (date: Date) => {
    onChange(toDateKey(date));
    setOpen(false);
  };

  return (
    <div className="datepicker">
      <button
        type="button"
        className={`datepicker-trigger${value ? ' has-value' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {formatDateLabel(value)}
      </button>
      {open && (
        <div className="datepicker-popover">
          <div className="datepicker-header">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">‹</button>
            <strong>{year}년 {month + 1}월</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달">›</button>
          </div>
          <div className="datepicker-grid datepicker-weekdays">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="datepicker-grid">
            {cells.map((date, i) => {
              if (!date) return <span key={`empty-${i}`} />;
              const key = toDateKey(date);
              return (
                <button
                  key={key}
                  type="button"
                  className={`${key === value ? 'selected' : ''} ${key === todayKey ? 'today' : ''}`}
                  onClick={() => selectDate(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="datepicker-actions">
            <button type="button" onClick={() => selectDate(new Date())}>오늘</button>
            <button type="button" onClick={() => { onChange(''); setOpen(false); }}>초기화</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HomePage() {
  useAuth();
  const [sessions, setSessions] = useState<DebateSession[]>([]);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    debateApi.list().then(setSessions).catch(console.error);
  }, []);

  const filtered = sessions.filter((s) => {
    if (stateFilter !== 'all' && s.state !== stateFilter) return false;
    if (dateFilter && s.created_at.slice(0, 10) !== dateFilter) return false;
    return true;
  });

  const grouped = STATE_ORDER
    .map((state) => ({
      state,
      items: filtered.filter((s) => s.state === state),
    }))
    .filter((group) => group.items.length > 0);

  const counts = sessions.reduce<Record<string, number>>((acc, s) => {
    acc[s.state] = (acc[s.state] ?? 0) + 1;
    return acc;
  }, {});

  const handleDelete = async (id: string, topic: string) => {
    if (!confirm(`"${topic}" 토픽을 삭제하시겠습니까?`)) return;
    await debateApi.delete(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <Layout>
      <div className="home-page">
        <div className="page-header">
          <h2>토픽 목록</h2>
          <Link to="/debates/new"><Button>새 토픽</Button></Link>
        </div>

        <div className="session-filters">
          <div className="session-state-tabs">
            {FILTER_STATES.map((state) => (
              <button
                key={state}
                className={stateFilter === state ? 'active' : ''}
                onClick={() => setStateFilter(state)}
              >
                {state === 'all' ? '전체' : STATE_LABELS[state]}
                <span>{state === 'all' ? sessions.length : counts[state] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="session-date-filter">
            <label>생성일</label>
            <DatePicker value={dateFilter} onChange={setDateFilter} />
          </div>
        </div>

        {sessions.length === 0 ? (
          <p className="empty">아직 토픽이 없습니다. 새 토픽을 시작해보세요.</p>
        ) : filtered.length === 0 ? (
          <p className="empty">조건에 맞는 토픽이 없습니다.</p>
        ) : (
          <div className="session-groups">
            {grouped.map((group) => (
              <section key={group.state} className="session-group">
                <div className="session-group-header">
                  <h3>{STATE_LABELS[group.state]}</h3>
                  <span>{group.items.length}개</span>
                </div>
                <ul className="session-list">
                  {group.items.map((s) => (
                    <li key={s.id} className="session-row">
                      <Link to={`/debates/${s.id}`} className="session-item">
                        <span className="session-topic">{s.topic}</span>
                        <span className={`status-badge status-${s.state}`}>
                          {STATE_LABELS[s.state] ?? s.state}
                        </span>
                        <span className="session-date">
                          {new Date(s.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="session-delete"
                        onClick={() => handleDelete(s.id, s.topic)}
                        aria-label={`${s.topic} 삭제`}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
