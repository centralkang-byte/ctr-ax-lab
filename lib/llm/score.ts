import { runChatGraph, type ChatTurn } from "./graph";
import type { LlmConfig } from "./catalog";
import { TRACKS, type Locale, type EvalResult } from "../evaluator-meta";
import { assembleResult, aiVibeCriterionKeys, type RawJudgement } from "../scoring";
import { getQuadrantThreshold } from "../settings";

// Server-side scoring of a finished one-page proposal against the AI-vibe rubric.
// The model judges each criterion (1–5 + rationale) and writes a short verdict +
// improvement suggestions; the deterministic maths (averages, overall, quadrant)
// happens in lib/scoring. Reuses the same LangGraph model binding as the chat.

// A compact, machine-friendly brief of every criterion the model must score.
function rubricBrief(locale: Locale): string {
  const ko = locale === "kr";
  return TRACKS["ai-vibe"].groups
    .map((g) => {
      const lines = g.criteria
        .map((c) => `  - ${c.key} (${ko ? c.label.kr : c.label.en}): ${c.desc}`)
        .join("\n");
      return `${ko ? g.label.kr : g.label.en}:\n${lines}`;
    })
    .join("\n\n");
}

function buildScorePrompt(idea: string, proposal: string, locale: Locale): string {
  const ko = locale === "kr";
  const keys = aiVibeCriterionKeys();
  const brief = rubricBrief(locale);

  const schema = `{
  "criteria": {
${keys.map((k) => `    "${k}": { "score": <1-5 integer>, "rationale": "<short ${ko ? "한국어" : "English"} reason>" }`).join(",\n")}
  },
  "summary": "<one short ${ko ? "한국어" : "English"} paragraph: the overall verdict and the single biggest weakness>",
  "suggestions": ["<concrete improvement>", "<concrete improvement>", "<concrete improvement>"]
}`;

  const intro = ko
    ? `당신은 CTR AX 과제 제안서를 평가하는 엄정하지만 공정한 심사위원입니다. 진짜 기준선을 지키세요: 4점이나 5점은 "구체성"으로 획득해야 합니다 — 명확한 대상 사용자, 구체적인 결과물(무엇을 만드는가), 그리고 "왜 되는가"에 대한 분명하고 신뢰할 만한 답이 있어야 합니다. 막연하거나 일반적이거나 가정에만 기댄 아이디어는 아무리 그럴듯하게 들려도 3점 이하입니다.`
    : `You are a rigorous but fair judge scoring a CTR AX project proposal. Hold a real bar: a 4 or 5 must be EARNED with specifics — a clear target user, a concrete end product (what actually ships), and a credible answer to "why this works." Vague, generic, or assumption-heavy ideas land at 3 or below, no matter how reasonable they sound.`;

  const rules = ko
    ? `규칙:
- 각 기준을 정수 1~5로 채점하고 짧은 근거를 다세요.
- 엄정하게 보정하세요: 5=탁월함(구체적이고 근거 있고 리스크가 해소됨), 4=강함(구체적인 디테일과 그 기준의 핵심 질문에 대한 분명한 답이 있음), 3=그럴듯하지만 일반적/불충분(구체성이 빠지면 여기가 기본값), 2=약함/모호함, 1=매우 부실.
- 점수를 올려주지 마세요. 구체성이나 분명한 답이 없으면 해당 기준은 3점에서 멈추세요. 두 점수 사이에서 망설여지면 더 낮은 쪽을 고르세요.
- 구체성(숫자, 명시된 사용자, 범위가 분명한 결과물)에는 점수를 주고, 막연함과 표시 없는 가정에는 점수를 깎으세요.
- 일부 기준(예: 도구 적합성)은 "쉬울수록 높은 점수"입니다. 기준 설명을 그대로 따르세요.
- "summary"는 종합 판단과 가장 큰 약점 한 가지를 한 문단으로.
- "suggestions"는 점수를 끌어올릴 구체적 보완책 3~4개.
- 오직 아래 JSON만 출력하세요. 코드펜스나 다른 설명은 절대 넣지 마세요.`
    : `Rules:
- Score each criterion as an integer 1–5 with a short rationale.
- Calibrate strictly: 5 = excellent (specific, evidenced, de-risked), 4 = strong (concrete specifics AND a clear answer to this criterion's key question), 3 = plausible but generic/underspecified (the DEFAULT when specifics are missing), 2 = weak or vague, 1 = very poor.
- Do NOT round up. If specifics or a concrete answer are missing, cap that criterion at 3. When torn between two scores, pick the LOWER.
- Reward concreteness (numbers, named users, a bounded end product); penalize hand-waving and unmarked assumptions.
- Some criteria (e.g. tool fit) are "higher = easier" — follow each criterion's description exactly.
- "summary" is one paragraph: the overall verdict and the single biggest weakness.
- "suggestions" are 3–4 concrete fixes that would raise the score.
- Output ONLY the JSON below. Never wrap it in code fences or add any other text.`;

  const seed = ko ? `씨앗 아이디어:\n${idea}` : `Seed idea:\n${idea}`;
  const doc = ko ? `제안서:\n${proposal}` : `Proposal:\n${proposal}`;

  return `${intro}\n\n${ko ? "채점 기준" : "Rubric"}:\n${brief}\n\n${rules}\n\n${ko ? "정확히 이 JSON 형식으로 답하세요" : "Respond in exactly this JSON shape"}:\n${schema}\n\n---\n${seed}\n\n${doc}`;
}

// Pull the first balanced JSON object out of a model reply, tolerating stray
// prose or ```json fences the model may add despite instructions.
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}

export async function scoreProposal(
  idea: string,
  proposal: string,
  locale: Locale,
  cfg: LlmConfig
): Promise<EvalResult> {
  const messages: ChatTurn[] = [
    { role: "user", content: buildScorePrompt(idea, proposal, locale) },
  ];
  // The judgement JSON (8 scores + rationales + summary + suggestions, often
  // Korean) does not fit the small chat-tuned maxTokens default — a truncated
  // JSON is unparseable and fails the whole scoring call. Same per-call
  // override pattern as the detail route's proposal budget.
  const judgeCfg: LlmConfig = { ...cfg, maxTokens: Math.max(cfg.maxTokens, 3000) };
  const reply = await runChatGraph(messages, judgeCfg);
  const json = extractJson(reply);
  if (!json) throw new Error("score_parse_failed");
  let raw: RawJudgement;
  try {
    raw = JSON.parse(json) as RawJudgement;
  } catch {
    throw new Error("score_parse_failed");
  }
  if (!raw || typeof raw !== "object" || !raw.criteria) {
    throw new Error("score_parse_failed");
  }
  // Honor the admin's current quadrant boundary so a freshly scored proposal's
  // stored verdict matches where the priority map would place it today.
  const quadrantThreshold = await getQuadrantThreshold();
  return assembleResult(raw, locale, cfg.model, quadrantThreshold);
}
