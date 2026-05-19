import { LLMProvider } from '../llm/provider';

interface Message {
  round: number;
  role: string;
  content: string;
  created_at: string;
}

interface Session {
  topic: string;
  description?: string;
  facilitator_model?: string;
  debater_a_model?: string;
  debater_b_model?: string;
  token_total: number;
  created_at: string;
}

const REPORT_SYSTEM = `당신은 AI 토픽 검증 결과를 전문적인 보고서로 정리하는 문서 작성 전문가입니다.

아래 형식을 참고해 Markdown 보고서를 작성하세요.

---
[보고서 제목 (주제 기반으로 작성, # 없음)]

([YYYY. MM. DD.] 형식의 날짜)

xchecker

## 요약

[토픽 검증의 핵심 결론을 3~5문장으로 요약]

## [쟁점1 제목]

[토론자 A·B 의견을 종합한 분석 내용을 3~6문장으로 서술]

## [쟁점2 제목]

[분석 내용]

...

## [핵심 발견 사항]

[결론을 바탕으로 한 핵심 발견 사항 서술]

## [시사점 및 제언]

[실질적인 시사점과 제언을 서술]
---

지침:
- 보고서 제목은 주제를 보고서명 형식으로 작성 (예: "○○ 관련 검토 보고", "○○ 분석 결과 보고")
- "추진 배경", "주요 내용 검토", "검토 의견" 같은 번호형 섹션 구분표는 사용하지 마세요.
- 원문 그대로 인용하지 말고 핵심 논점을 요약·재구성
- 단락은 짧게 (3~6문장), 소제목은 내용을 잘 반영하는 명사형으로
- 객관적·전문적 문체 사용, 모든 내용은 한국어로
- Markdown 코드블록(\`\`\`) 없이 순수 텍스트만 출력`;

function buildContext(session: Session, messages: Message[]): string {
  const date = new Date(session.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });

  const lines: string[] = [
    `[토픽] ${session.topic}`,
    `[생성일] ${date}`,
    `[토큰 사용량] ${session.token_total.toLocaleString()}`,
  ];
  if (session.description?.trim()) {
    lines.push(`[배경 설명]\n${session.description.trim()}`);
  }
  lines.push('');

  const ROLE: Record<string, string> = {
    facilitator: '진행자',
    debater_a: '토론자 A',
    debater_b: '토론자 B',
  };

  let currentRound = -1;
  for (const msg of messages) {
    if (msg.round > 0 && msg.round !== currentRound) {
      currentRound = msg.round;
      lines.push(`\n=== 라운드 ${currentRound} ===`);
    }
    if (msg.round === 0 && msg.role === 'facilitator') {
      lines.push('\n=== 최종 결론 ===');
    }
    lines.push(`[${ROLE[msg.role] ?? msg.role}]\n${msg.content}`);
  }

  return lines.join('\n');
}

export async function generateReport(
  session: Session,
  messages: Message[],
  provider: LLMProvider,
): Promise<string> {
  const context = buildContext(session, messages);
  const res = await provider.chat(
    [
      { role: 'system', content: REPORT_SYSTEM },
      { role: 'user', content: `다음 토픽 검증 내용을 보고서로 작성해주세요:\n\n${context}` },
    ],
    6000,
  );
  return res.content.replace(/^```[^\n]*\n?/m, '').replace(/```\s*$/m, '').trim();
}
