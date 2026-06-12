import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getEvaluation } from "@/lib/eval-log";
import { streamChat, type ChatTurn } from "@/lib/llm/graph";
import { getActiveLlmConfig } from "@/lib/settings";
import type { LlmConfig } from "@/lib/llm/catalog";
import { TRACKS, type Locale } from "@/lib/evaluator-meta";

export const runtime = "nodejs";

// Admin-only: the LLM drafts reviewer feedback for one proposal. It reads the
// one-pager + the seed idea + the rubric score and, through the same
// impact/feasibility lenses the coach uses, writes a concise note to the author
// and recommends a decision. The admin always edits and decides — this is a
// drafting aid, never an automatic verdict.
//
// Output is streamed plain text. The FIRST line is a recommendation marker —
//   @@RECOMMEND: approved | changes_requested | rejected
// reusing the codebase's @@OPTIONS marker convention — and the rest is the
// feedback markdown. The client strips the marker and preselects the decision.

const MAX_PROPOSAL = 12000;

function rubricDimensions(): string {
  return TRACKS["ai-vibe"].groups
    .map((g) => `${g.label.en} — ${g.criteria.map((c) => c.label.en).join(", ")}`)
    .join("\n");
}

function buildSystem(locale: Locale): string {
  const dims = rubricDimensions();
  return locale === "kr"
    ? `당신은 CTR의 AI 프로젝트 제안서를 심사하는 노련한 의사결정자입니다. 한 장짜리 제안서를 읽고, 작성자에게 보낼 **검토 피드백 초안**을 쓰고 결정을 추천하세요.

출력 형식(반드시 지키세요):
- 맨 첫 줄은 정확히 이 형식의 추천 마커: \`@@RECOMMEND: approved\` 또는 \`@@RECOMMEND: changes_requested\` 또는 \`@@RECOMMEND: rejected\`
- 그 다음 줄부터 작성자에게 직접 건네는 피드백을 마크다운으로 쓰세요. 간결하게(150단어 이내).

피드백 작성 지침:
- 잘된 점 1~2가지를 먼저 짚고, 그다음 가장 중요한 보완점이나 빈틈을 구체적으로 지적하세요.
- changes_requested라면, 작성자가 실제로 무엇을 고쳐야 하는지 실행 가능한 항목으로 적으세요.
- approved라면 왜 통과인지 한두 문장으로, rejected라면 왜 지금은 진행하지 않는지 정중하지만 분명하게 적으세요.
- 아래 임팩트·실현가능성 관점을 심사 기준으로 삼되 점수는 매기지 마세요:
${dims}`
    : `You are a seasoned decision-maker reviewing AI-project proposals for CTR. Read the one-page proposal and write a **draft of reviewer feedback** for the author, plus a recommended decision.

Output format (follow exactly):
- The FIRST line is a recommendation marker, exactly one of: \`@@RECOMMEND: approved\` or \`@@RECOMMEND: changes_requested\` or \`@@RECOMMEND: rejected\`
- From the next line on, write the feedback addressed directly to the author, in markdown. Keep it concise (under 150 words).

How to write the feedback:
- Name 1–2 genuine strengths first, then point to the most important gap or weakness specifically.
- If changes_requested, give actionable items the author can actually fix.
- If approved, say in a sentence or two why it clears the bar; if rejected, say plainly but respectfully why it isn't worth pursuing now.
- Use the Impact and Feasibility lenses below as your review criteria, but assign no scores:
${dims}`;
}

function buildUser(
  locale: Locale,
  seed: string,
  proposal: string,
  score: { overall: number; quadrant?: string; verdict: string }
): string {
  const ko = locale === "kr";
  const scoreLine = score.overall
    ? ko
      ? `현재 루브릭 점수: ${score.overall.toFixed(1)}/5${score.quadrant ? ` · ${score.quadrant}` : ""}${score.verdict ? ` · ${score.verdict}` : ""}`
      : `Current rubric score: ${score.overall.toFixed(1)}/5${score.quadrant ? ` · ${score.quadrant}` : ""}${score.verdict ? ` · ${score.verdict}` : ""}`
    : ko
      ? "현재 루브릭 점수: 없음"
      : "Current rubric score: none";
  const seedLabel = ko ? "씨앗 아이디어/문제" : "Seed idea / problem";
  const proposalLabel = ko ? "제안서 (한 장)" : "Proposal (one-pager)";
  return `${scoreLine}\n\n${seedLabel}:\n"${seed}"\n\n${proposalLabel}:\n${proposal}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!(await isAdmin(session?.user?.email))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const entry = await getEvaluation(id);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!entry.proposal) {
    return NextResponse.json({ error: "no_proposal" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { locale?: string } | null;
  const locale: Locale = body?.locale === "en" ? "en" : entry.locale === "en" ? "en" : "kr";

  const messages: ChatTurn[] = [
    { role: "system", content: buildSystem(locale) },
    {
      role: "user",
      content: buildUser(locale, entry.text, entry.proposal.slice(0, MAX_PROPOSAL), {
        overall: entry.overall,
        quadrant: entry.quadrant,
        verdict: entry.verdict,
      }),
    },
  ];

  let cfg: LlmConfig;
  try {
    const base = await getActiveLlmConfig();
    cfg = { ...base, temperature: 0.4, maxTokens: 600 };
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "draft_failed" },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamChat(messages, cfg)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        /* best-effort: client treats a truncated stream as a failure */
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
