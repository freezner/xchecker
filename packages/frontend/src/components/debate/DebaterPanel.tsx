import React from 'react';
import { DebateEvent } from '../../hooks/useDebateSocket';
import { MarkdownText } from '../ui/MarkdownText';

interface Props {
  role: 'debater_a' | 'debater_b';
  label: string;
  events: DebateEvent[];
  streamingChunk: string;
}

export function DebaterPanel({ role, label, events, streamingChunk }: Props) {
  const myEvents = events.filter((e) => e.role === role && e.type === 'message').slice().reverse();

  return (
    <div className={`debater-panel panel-${role}`}>
      <h3>{label}</h3>
      <div className="messages">
        {streamingChunk && (
          <div className="message streaming">
            <span className="round-badge">...</span>
            <MarkdownText content={streamingChunk} />
            <span className="cursor">|</span>
          </div>
        )}
        {myEvents.map((e, i) => (
          <div key={i} className="message">
            <span className="round-badge">R{e.round}</span>
            <MarkdownText content={e.content ?? ''} />
          </div>
        ))}
      </div>
    </div>
  );
}
