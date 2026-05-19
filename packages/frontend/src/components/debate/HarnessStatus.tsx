import React from 'react';
import { HarnessConfig } from '../../api/debate';

interface Props {
  config: HarnessConfig;
  round: number;
  tokenTotal: number;
  status: string;
}

export function HarnessStatus({ config, round, tokenTotal, status }: Props) {
  const tokenPct = config.maxTotalTokens
    ? Math.min((tokenTotal / config.maxTotalTokens) * 100, 100)
    : 0;
  const roundPct = config.maxRounds
    ? Math.min((round / config.maxRounds) * 100, 100)
    : 0;

  return (
    <div className="harness-status">
      <div className="harness-row">
        <span>라운드 {round} / {config.maxRounds ?? '?'}</span>
        <div className="progress"><div style={{ width: `${roundPct}%` }} /></div>
      </div>
      <div className="harness-row">
        <span>토큰 {tokenTotal.toLocaleString()} / {config.maxTotalTokens?.toLocaleString() ?? '?'}</span>
        <div className="progress"><div style={{ width: `${tokenPct}%` }} /></div>
      </div>
      <div className={`status-badge status-${status}`}>{status}</div>
    </div>
  );
}
