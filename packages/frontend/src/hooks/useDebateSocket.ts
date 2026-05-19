import { useEffect, useRef, useState } from 'react';

export interface DebateEvent {
  type: string;
  role?: 'facilitator' | 'debater_a' | 'debater_b';
  round?: number;
  content?: string;
  tokenTotal?: number;
  reason?: string;
}

export interface DebateState {
  events: DebateEvent[];
  streaming: Record<string, string>;
  tokenTotal: number;
  round: number;
  status: 'idle' | 'running' | 'done' | 'error' | 'stopped';
}

function getWsBase() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL as string;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}`;
}

export function useDebateSocket(
  sessionId: string | null,
  initialStatus: DebateState['status'] = 'idle',
  initialEvents: DebateEvent[] = [],
) {
  const [state, setState] = useState<DebateState>({
    events: initialEvents,
    streaming: {},
    tokenTotal: 0,
    round: 0,
    status: initialStatus,
  });
  const wsRef = useRef<WebSocket | null>(null);

  const connect = (fresh = false) => {
    if (!sessionId || wsRef.current) return;

    if (fresh) {
      setState({ events: [], streaming: {}, tokenTotal: 0, round: 0, status: 'idle' });
    }

    const ws = new WebSocket(`${getWsBase()}/api/debates/${sessionId}/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const event = JSON.parse(e.data) as DebateEvent;

      setState((prev) => {
        const next = { ...prev };

        if (event.type === 'chunk' && event.role) {
          next.streaming = {
            ...prev.streaming,
            [event.role]: (prev.streaming[event.role] ?? '') + (event.content ?? ''),
          };
        } else if (event.type === 'message' && event.role) {
          next.streaming = { ...prev.streaming, [event.role]: '' };
          next.events = [...prev.events, event];
        } else {
          next.events = [...prev.events, event];
        }

        if (event.type === 'round_start') next.round = event.round ?? 0;
        if (event.type === 'harness_update') next.tokenTotal = event.tokenTotal ?? 0;
        if (event.type === 'done') next.status = 'done';
        if (event.type === 'error') next.status = 'error';
        if (event.type === 'harness_stop') next.status = 'done';

        return next;
      });
    };

    ws.onopen = () => setState((p) => ({ ...p, status: 'running' }));
    ws.onclose = () => {
      wsRef.current = null;
      setState((p) => p.status === 'running' ? { ...p, status: 'stopped' } : p);
    };
  };

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  useEffect(() => () => disconnect(), []);

  return { state, connect, disconnect };
}
