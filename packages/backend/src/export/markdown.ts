interface Message {
  round: number;
  role: string;
  content: string;
  created_at: string;
}

interface Session {
  topic: string;
  harness_config: { maxRounds: number; maxTotalTokens: number };
  token_total: number;
  created_at: string;
}

export function buildMarkdown(session: Session, messages: Message[]): string {
  const lines: string[] = [
    `# 토픽 검증 결과: ${session.topic}`,
    '',
    `**생성일**: ${new Date(session.created_at).toLocaleString('ko-KR')}`,
    `**총 토큰 사용량**: ${session.token_total.toLocaleString()}`,
    '',
    '---',
    '',
  ];

  let currentRound = -1;
  for (const msg of messages) {
    if (msg.round !== currentRound && msg.round > 0) {
      currentRound = msg.round;
      lines.push(`## 라운드 ${currentRound}`, '');
    }

    const roleLabel: Record<string, string> = {
      facilitator: '**진행자**',
      debater_a: '**토론자 A**',
      debater_b: '**토론자 B**',
      system: '_시스템_',
    };

    if (msg.round === 0 && msg.role === 'facilitator') {
      lines.push('## 최종 결론', '');
    }

    lines.push(`### ${roleLabel[msg.role] ?? msg.role}`, '', msg.content, '');
  }

  return lines.join('\n');
}
