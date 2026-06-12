import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { streamChat, type ChatTurn } from "@/lib/llm/graph";
import { getActiveLlmConfig } from "@/lib/settings";
import { findProvider, type LlmConfig } from "@/lib/llm/catalog";
import { identityFromEmail } from "@/lib/identity";
import { checkRateLimit, logLlmCall } from "@/lib/llm-usage";
import { TRACKS, type Locale } from "@/lib/evaluator-meta";

export const runtime = "nodejs";

// Conversational project brainstorm. Given a rough seed idea (or just a
// problem), the coach helps shape it through focused questions — using the
// AI-project rubric's dimensions as its instinct for what to probe, never as a
// user-facing score. When `finalize` is set it emits a one-page project
// PROPOSAL (a pitch to get a yes from a decision-maker). The coach is candid:
// it will say when an idea isn't there yet and name what's missing, but it
// never refuses to continue or to generate.

type ChatMsg = { role: "user" | "assistant"; content: string };

const MAX_TURNS = 24;
const MAX_LEN = 4000;

// A compact brief of the rubric dimensions, derived from the AI-project track so
// the coach's probing stays in sync with evaluator-meta. We feed the model the
// dimensions to weigh — not a scoring instruction.
function rubricDimensions(): string {
  return TRACKS["ai-vibe"].groups
    .map(
      (g) =>
        `${g.label.en} — ${g.criteria.map((c) => c.label.en).join(", ")}`
    )
    .join("\n");
}

function buildSystem(idea: string, locale: Locale): string {
  const ko = locale === "kr";
  const dims = rubricDimensions();

  const context = ko
    ? `사용자가 가져온 씨앗 아이디어/문제:\n"${idea}"`
    : `The seed idea / problem the user brought:\n"${idea}"`;

  const guide = ko
    ? `당신은 거친 아이디어를 '승인받을 만한' 프로젝트로 다듬도록 돕는 노련한 프로덕트 코치입니다. 목표는 의사결정자가 "좋아, 진행하자"라고 말하게 만들 한 장짜리 제안서입니다.

진행 방식:
- 한국어로, 간결하고 실용적으로 대화하세요.
- 한 번에 질문은 1개만 하세요. 한꺼번에 쏟아내지 마세요.
- 매 질문 끝에, 맨 마지막 줄에 사용자가 고를 만한 보기 3~4개를 정확히 이 형식으로 제시하세요: \`@@OPTIONS: 보기1 || 보기2 || 보기3\`. 각 보기는 12자 이내의 구체적인 예시 답변이며, 서로 다른 현실적인 선택지여야 합니다. 사용자는 보기를 고르거나 직접 입력할 수 있습니다. 이 줄은 질문할 때만 넣고, 그 뒤에는 아무것도 쓰지 마세요.
- 제대로 된 발견(discovery) 과정을 거치세요. 제안서를 만들 만큼 충분해지기 전까지 최소 5개의 질문을 주고받아야 합니다. 첫 답변 한두 개로 서둘러 제안서로 넘어가지 마세요.
- **페인포인트부터 파세요.** 처음 1~2개 질문은 실제 고통에 집중하세요: 지금 정확히 무엇이 불편한가, 얼마나 자주 겪는가, 지금은 어떻게 (어떤 임시방편으로) 해결하는가, 그 문제 때문에 드는 시간·비용·실수는 얼마인가. 고통이 구체적으로 드러난 다음에야 해결책으로 넘어가세요.
- 그다음 다룰 영역: 정확한 대상 사용자와 그들의 'job-to-be-done', 실제로 만들어 낼 결과물(end product), 그 가치(왜 중요한가, 가능하면 숫자), 성공 지표(숫자 하나), 그리고 실현가능성·리스크.
- CTR 특화 확인 사항 — 대화 중 자연스럽게, 해당될 때 반드시 짚으세요:
  1) 다음 액션(가장 중요): "이 결과를 누가 받고, 받은 사람은 무엇을 하나요?" 분석으로 끝나는 과제가 가장 흔한 실패입니다. AI가 메일 초안·결재 양식·알림까지 이어줄 수 있는지 물으세요.
  2) 과제 크기: 직무 전체(거대한 덩어리)인지 하나의 반복 작업인지 확인하고, 너무 크면 "첫 30분짜리 한 조각"으로 좁히세요. 너무 사소하면(월 1시간 미만) 더 큰 반복 업무가 없는지 물으세요.
  3) 데이터 출처: 입력 데이터가 어느 시스템(SAP/PLM/MES/Excel/e-Accounting)에 정형으로 있는지, 아니면 머릿속·구두 정보인지 물으세요. 출처를 못 대면 "데이터 출처 인터뷰"가 선행 과제임을 짚으세요.
  4) 시스템 쓰기·보안: 시스템에 쓰기(write-back)가 필요한지, 읽기·파일 추출만으로 시작할 수 있는지 확인하세요. 쓰기·보안 이슈가 있으면 읽기 전용 1단계로 범위를 좁히도록 권하세요.
  5) 시간 환산: 절감 시간이 1인 기준인지 조직 전체 합계인지, 실측인지 추정인지 구분하게 하세요.
  6) 검증자: 결과가 의사결정에 쓰이면 누가 최종 확인하는지 물으세요. 원칙은 "AI는 초안, 사람이 확정"입니다.
  7) 횡단 연결: 옆 팀·다른 본부도 같은 작업을 하는지, 이 결과가 다른 본부의 입력이 되는지 물으세요. 병목은 부서 사이에 있는 경우가 많습니다.
  8) 다법인 현실: 여러 법인·공장의 양식이 서로 다른지, 통화·환율 처리가 필요한지 확인하세요.
- 아래 임팩트·실현가능성 관점을 머릿속 기준으로 삼아 약한 곳을 파고드세요(점수는 매기지 말고 대화로 풀어내세요):
${dims}
- 사용자의 답을 반영해 다음 질문을 다듬으세요. 이미 답한 것은 다시 묻지 마세요. 답이 모호하면 더 구체적으로 유도하세요.
- 솔직하게 피드백하세요. 아이디어가 아직 설익었거나 가치가 약해 보이면 "솔직히 아직 이건 부족해요 — ○○가 빠졌어요"처럼 분명히 말하고 무엇이 빠졌는지 짚으세요. 다만 대화를 거부하거나 막지는 마세요.
- 5개 이상의 질문에 답하고 핵심 빈틈이 메워지면, 이제 '제안서 생성' 버튼으로 한 장짜리 제안서를 만들 수 있다고 알려주세요.`
    : `You are a seasoned product coach helping turn a rough idea into a project worth approving. The goal is a one-page proposal that makes a decision-maker say "yes, let's do it."

How to work:
- Converse in English, concise and practical.
- Ask only ONE focused question at a time. Do not dump a long list.
- End each question with a final line offering 3–4 answer choices the user might pick, in exactly this format: \`@@OPTIONS: choice 1 || choice 2 || choice 3\`. Each choice is a concrete example answer under ~6 words, and the choices should be genuinely different options. The user can pick one or type their own. Only include this line when asking a question, and write nothing after it.
- Run a real discovery process: exchange at least 5 questions before the idea is solid enough to draft a proposal. Don't rush to the proposal after one or two answers.
- **Start with the pain point.** Spend your first 1–2 questions on the real pain: what exactly is hard today, how often it happens, how they cope now (the current workaround), and what the problem costs in time, money, or mistakes. Only move to the solution once the pain is concrete.
- Then cover: exact target users and their job-to-be-done, the actual end product (what ships), its value (why it matters, a number if possible), one success metric, and feasibility/risk.
- CTR-specific probes — work these in naturally whenever they apply:
  1) Next action (most important): "Who receives this output, and what do they DO with it?" Analysis that ends as analysis is the most common failure. Ask whether the AI can carry through to the mail draft, approval form, or alert.
  2) Task size: is this an entire job function (a giant chunk) or one repeatable task? If huge, narrow to a first 30-minute slice; if trivial (under ~1 h/month), ask for a bigger repetitive pain.
  3) Data source: is the input data structured in a NAMED system (SAP/PLM/MES/Excel/e-Accounting), or does it live in someone's head? If unnamed, flag a data-source interview as the real first step.
  4) Write-back & security: does this need to WRITE into a system? Recommend starting read-only / file-export if write access or security gates are in the way.
  5) Time normalization: are the saved hours per person or an org-wide total? Measured or estimated?
  6) Verifier: if the output feeds a decision, who confirms it? The rule is "AI drafts, a human confirms."
  7) Cross-division: does a neighboring team or division do the same work? Does this output become another division's input? Bottlenecks usually live BETWEEN departments.
  8) Multi-entity reality: do formats differ across plants/entities, and is currency/FX handling needed?
- Use the Impact and Feasibility lenses below as your private instinct for where an idea is weak — probe those gaps in conversation, never assign scores:
${dims}
- Adapt each question to the user's answers; never re-ask what's answered. If an answer is vague, push for specifics.
- Be candid. If the idea isn't there yet or the value looks thin, say so plainly — "honestly, this isn't there yet — you're missing X" — and name what's missing. But never refuse to continue.
- Once they've answered 5+ questions and the key gaps are filled, tell them they can now generate the one-page proposal via the 'Generate proposal' button.`;

  return `${guide}\n\n---\n${context}`;
}

function finalizeInstruction(locale: Locale): string {
  return locale === "kr"
    ? `이제 대화에서 모은 내용을 바탕으로 의사결정자를 설득하는 **한 장짜리 프로젝트 제안서**를 마크다운으로 작성하세요. 60초 안에 훑어볼 사람을 위한 문서입니다.

맨 첫 줄은 \`# <짧은 프로젝트 제목>\` 형식의 제목 한 줄로 시작하세요. 그다음 아래 섹션을 정확히 이 순서로 포함하세요:

## 요청 사항 (The ask)
## 문제
## 결과물 (무엇을 만드는가)
## 가치 (왜 가치 있는가)
## 대상 사용자
## 성공 판단 기준
## 다음 액션 (결과를 받는 사람과 그 사람이 하는 일)
## 비용·리스크

규칙:
- "결과물"은 구체적이고 범위가 분명해야 합니다.
- "가치"는 가능하면 숫자나 명확한 before/after로 표현하세요.
- "비용·리스크"에는 대략의 규모와 가장 크게 잘못될 수 있는 한 가지를 솔직히 적으세요.
- 대화에서 확정되지 않은 항목은 합리적 가정을 적되 "(가정)"으로 표시하세요.
- "다음 액션"에는 결과물을 받는 사람과 그 사람이 그걸로 무엇을 하는지 명시하세요. 받는 사람이 없으면 솔직히 "없음 — 보완 필요"라고 쓰세요.
- 질문은 하지 말고 제안서만 출력하세요.`
    : `Now write a persuasive **one-page project proposal** in markdown from what the conversation gathered. It's for a decision-maker skimming in 60 seconds.

Start the very first line with a title line in the form \`# <short project title>\`. Then include exactly these sections in this order:

## The ask
## Problem
## End product (what ships)
## Value (why it's worth it)
## Who it's for
## How we'd know it worked
## Next action (who receives the output and what they do)
## Effort & risk

Rules:
- "End product" must be concrete and bounded.
- "Value" should use a number or a clear before/after where possible.
- "Effort & risk" should state a rough size and honestly name the one thing most likely to go wrong.
- For anything not settled in the chat, state a reasonable assumption marked "(assumption)".
- "Next action" must name who receives the output and what they do with it. If nobody does, write "none yet — needs work" honestly.
- Do not ask questions — output only the proposal.`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    idea?: string;
    locale?: string;
    messages?: ChatMsg[];
    finalize?: boolean;
  };

  const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, MAX_LEN) : "";
  if (idea.length < 10) {
    return NextResponse.json({ error: "missing_idea" }, { status: 400 });
  }
  const locale: Locale = body.locale === "en" ? "en" : "kr";
  const finalize = body.finalize === true;

  // Per-user hourly budget (outside-voice finding #7): cap runaway coach calls.
  // Identity comes from the session (middleware already requires sign-in); an
  // unattributable request fails open rather than blocking.
  const session = await auth();
  const me = identityFromEmail(session?.user?.email);
  const limit = await checkRateLimit(me, "detail");
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message:
          locale === "kr"
            ? `시간당 호출 한도(${limit.cap}회)를 초과했습니다. 잠시 후 다시 시도해 주세요.`
            : `Hourly request limit (${limit.cap}) reached. Please try again later.`,
      },
      { status: 429 }
    );
  }

  const convo: ChatMsg[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_LEN) }))
        .slice(-MAX_TURNS)
    : [];

  const messages: ChatTurn[] = [{ role: "system", content: buildSystem(idea, locale) }];

  if (convo.length === 0 && !finalize) {
    // Kick off: ask the model to open the conversation with its first questions.
    messages.push({
      role: "user",
      content:
        locale === "kr"
          ? "이 아이디어를 구체화하고 싶어요. 시작하는 첫 질문을 해주세요."
          : "I want to flesh out this idea. Please open with your first questions.",
    });
  } else {
    messages.push(...convo);
    if (finalize) {
      messages.push({ role: "user", content: finalizeInstruction(locale) });
    }
  }

  let cfg: LlmConfig;
  try {
    const base = await getActiveLlmConfig();
    // Chat wants a touch more warmth and a larger budget when writing the proposal.
    cfg = { ...base, temperature: 0.5, maxTokens: finalize ? 1800 : 700 };
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "chat_failed" },
      { status: 502 }
    );
  }

  // The model is constructed INSIDE the stream (graph.ts), after the 200 is
  // committed — so a missing API key would otherwise surface as a silent empty
  // stream with nothing in the server logs. Check the key here, while a clean
  // JSON 502 is still possible.
  const keyEnv = findProvider(cfg.provider)?.apiKeyEnv;
  if (keyEnv && !process.env[keyEnv]) {
    return NextResponse.json({ error: `${keyEnv} is not set` }, { status: 502 });
  }

  // Count this call toward the hourly budget + usage log (never blocks the call).
  await logLlmCall({ submitter: me, route: "detail", model: cfg.model });

  // Stream the reply as plain UTF-8 text chunks. The config is resolved above
  // (before the stream opens) so config errors stay a clean JSON 502 — once
  // bytes start flowing the status is already committed.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamChat(messages, cfg)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        // Best-effort: the client treats an empty/truncated stream as a failure,
        // but leave the cause in the server logs instead of swallowing it.
        console.error("detail stream failed:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy buffering so chunks reach the browser as they're produced.
      "X-Accel-Buffering": "no",
    },
  });
}
