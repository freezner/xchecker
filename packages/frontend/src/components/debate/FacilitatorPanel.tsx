import React from 'react';
import { DebateEvent } from '../../hooks/useDebateSocket';
import { MarkdownText } from '../ui/MarkdownText';

interface Props {
  events: DebateEvent[];
  streamingChunk: string;
}

export function FacilitatorPanel({ events, streamingChunk }: Props) {
  const facilitatorEvents = events
    .filter((e) => e.role === 'facilitator' || e.type === 'synthesis' || e.type === 'conclusion')
    .slice()
    .reverse();

  return (
    <div className="facilitator-panel">
      <h3>진행자</h3>
      <div className="messages">
        {streamingChunk && (
          <div className="message streaming">
            <MarkdownText content={streamingChunk} />
            <span className="cursor">|</span>
          </div>
        )}
        {facilitatorEvents.map((e, i) => (
          <div key={i} className={`message ${e.type}`}>
            {e.round && <span className="round-badge">R{e.round}</span>}
            {e.type === 'synthesis' && <span className="tag">합산</span>}
            {e.type === 'conclusion' && <span className="tag">결론</span>}
            <MarkdownText content={e.content ?? ''} />
          </div>
        ))}
      </div>
    </div>
  );
}
