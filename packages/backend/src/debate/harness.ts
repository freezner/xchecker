export interface HarnessConfig {
  maxRounds: number;           // 최대 토론 라운드
  maxTimeSeconds: number;      // 전체 최대 허용 시간(초)
  maxTokensPerTurn: number;    // 한 턴당 최대 토큰
  maxTotalTokens: number;      // 세션 전체 누적 최대 토큰
  stopOnConsensus: boolean;    // 합의 도달 시 조기 종료
}

export const DEFAULT_HARNESS: HarnessConfig = {
  maxRounds: 5,
  maxTimeSeconds: 600,
  maxTokensPerTurn: 4000,
  maxTotalTokens: 100000,
  stopOnConsensus: true,
};

export interface HarnessCheckResult {
  shouldStop: boolean;
  reason?: 'max_rounds' | 'max_time' | 'max_tokens';
}

export function checkHarness(
  config: HarnessConfig,
  currentRound: number,
  tokenTotal: number,
  startedAt: Date,
): HarnessCheckResult {
  if (currentRound > config.maxRounds) {
    return { shouldStop: true, reason: 'max_rounds' };
  }

  const elapsed = (Date.now() - startedAt.getTime()) / 1000;
  if (elapsed >= config.maxTimeSeconds) {
    return { shouldStop: true, reason: 'max_time' };
  }

  if (tokenTotal >= config.maxTotalTokens) {
    return { shouldStop: true, reason: 'max_tokens' };
  }

  return { shouldStop: false };
}
