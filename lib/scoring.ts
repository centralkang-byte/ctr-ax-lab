// Pure scoring helpers — quadrant placement and assembling a raw model judgement
// into the shared EvalResult shape. No server-only imports, so this is safe to
// use from both the client (ScorePanel) and the server (lib/llm/score.ts).
//
// The model returns only a per-criterion score + rationale plus a summary and
// suggestions; the group averages, the overall score, and the quadrant are
// computed here in code so the maths is deterministic and never hallucinated.

import {
  TRACKS,
  allCriteria,
  type EvalResult,
  type Locale,
  type ScoreRow,
} from "./evaluator-meta";

// A score at or above this on a 1–5 axis counts as "high". 3.5 (not the 3.0
// midpoint) so a merely-average idea doesn't get flattered into Quick Win — it
// has to clearly clear the bar. e.g. Impact 3.5 / Feasibility 3.3 → Big Bet.
// Admin-configurable (lib/settings) so the portfolio-map boundaries can be
// recalibrated without a redeploy; this default seeds the control. The bounds
// keep the line in the sensible middle of the axis — a threshold at the extremes
// makes one quadrant swallow everything.
export const DEFAULT_QUADRANT_THRESHOLD = 3.5;
export const QUADRANT_THRESHOLD_MIN = 2.5;
export const QUADRANT_THRESHOLD_MAX = 4.5;

/** Coerce any input to a valid quadrant threshold in [MIN, MAX], rounded to 0.5. */
export function clampQuadrantThreshold(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_QUADRANT_THRESHOLD;
  const clamped = Math.max(QUADRANT_THRESHOLD_MIN, Math.min(QUADRANT_THRESHOLD_MAX, n));
  return Math.round(clamped * 2) / 2;
}

// Minimum overall score (0–5) required to submit a proposal to the team history.
// Admin-configurable (lib/settings); these bound and seed the control. Lives
// here in the client-safe scoring module so both the admin slider and the
// submit-gate UI can import the bounds without pulling in server-only code.
export const DEFAULT_SUBMIT_THRESHOLD = 4;
export const SUBMIT_THRESHOLD_MIN = 0;
export const SUBMIT_THRESHOLD_MAX = 5;

/** Coerce any input to a valid submit threshold in [0, 5], rounded to 0.5. */
export function clampSubmitThreshold(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_SUBMIT_THRESHOLD;
  const clamped = Math.max(SUBMIT_THRESHOLD_MIN, Math.min(SUBMIT_THRESHOLD_MAX, n));
  return Math.round(clamped * 2) / 2;
}

export type QuadrantKey = "quick-win" | "big-bet" | "fill-in" | "money-pit";

// 2×2 priority quadrant (Impact × Feasibility). Labels are the familiar English
// framework terms, shown as-is in both locales — translating them reads worse.
export const QUADRANTS: Record<QuadrantKey, { label: string; kr: string }> = {
  "quick-win": { label: "Quick Win", kr: "지금 바로 (Quick Win)" },
  "big-bet": { label: "Big Bet", kr: "큰 베팅 (Big Bet)" },
  "fill-in": { label: "Fill-in", kr: "여력될 때 (Fill-in)" },
  "money-pit": { label: "Money Pit", kr: "함정 (Money Pit)" },
};

export function quadrantKey(
  impact: number,
  feasibility: number,
  threshold: number = DEFAULT_QUADRANT_THRESHOLD
): QuadrantKey {
  const highImpact = impact >= threshold;
  const highFeasibility = feasibility >= threshold;
  if (highImpact && highFeasibility) return "quick-win";
  if (highImpact) return "big-bet";
  if (highFeasibility) return "fill-in";
  return "money-pit";
}

export function quadrantLabel(key: QuadrantKey, locale: Locale): string {
  return locale === "kr" ? QUADRANTS[key].kr : QUADRANTS[key].label;
}

// The one way every surface derives a proposal's *live* quadrant label from its
// stored axis averages at the admin's current boundary. Recomputing through this
// (instead of reading the stored `quadrant` string, frozen at score time) keeps
// the priority map, the detail panels, and the list rows from disagreeing when
// the admin moves the threshold. Returns null when the axes aren't scored yet —
// callers fall back to the stored string.
export function quadrantLabelForGroups(
  groupAverages: { key: string; average: number }[] | undefined,
  locale: Locale,
  threshold: number = DEFAULT_QUADRANT_THRESHOLD
): string | null {
  const impact = groupAverages?.find((g) => g.key === "impact")?.average;
  const feasibility = groupAverages?.find((g) => g.key === "feasibility")?.average;
  if (typeof impact !== "number" || typeof feasibility !== "number") return null;
  return quadrantLabel(quadrantKey(impact, feasibility, threshold), locale);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(1, Math.min(5, Math.round(v)));
}

// The minimal shape we ask the model for: a score (1–5) + short rationale per
// criterion key, a one-paragraph summary, and a few improvement suggestions.
export interface RawJudgement {
  criteria: Record<string, { score?: number; rationale?: string }>;
  summary?: string;
  suggestions?: string[];
}

// Turn the model's raw per-criterion judgement into a fully-computed EvalResult
// for the AI-vibe track: rows, group averages, overall, and quadrant.
export function assembleResult(
  raw: RawJudgement,
  locale: Locale,
  model: string,
  threshold: number = DEFAULT_QUADRANT_THRESHOLD
): EvalResult {
  const track = TRACKS["ai-vibe"];
  const localized = (l: { kr: string; en: string }) => (locale === "kr" ? l.kr : l.en);

  const scores: ScoreRow[] = [];
  const groupAverages: EvalResult["groupAverages"] = [];

  for (const group of track.groups) {
    let sum = 0;
    for (const c of group.criteria) {
      const raw1 = raw.criteria?.[c.key];
      const score = clampScore(raw1?.score);
      sum += score;
      scores.push({
        groupKey: group.key,
        groupLabel: localized(group.label),
        criterionKey: c.key,
        label: localized(c.label),
        score,
        rationale: typeof raw1?.rationale === "string" ? raw1.rationale.slice(0, 600) : "",
      });
    }
    groupAverages.push({
      key: group.key,
      label: localized(group.label),
      average: round1(sum / group.criteria.length),
    });
  }

  const impact = groupAverages.find((g) => g.key === "impact")?.average ?? 0;
  const feasibility = groupAverages.find((g) => g.key === "feasibility")?.average ?? 0;
  const overall = round1((impact + feasibility) / 2);
  const qKey = quadrantKey(impact, feasibility, threshold);

  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.filter((s) => typeof s === "string" && s.trim()).slice(0, 6).map((s) => s.trim())
    : [];

  return {
    trackId: track.id,
    verdict: QUADRANTS[qKey].label, // English label — used by the admin table
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    suggestions,
    scores,
    groupAverages,
    overall,
    quadrant: QUADRANTS[qKey].label,
    model,
  };
}

// The exhaustive list of criterion keys the model must return, derived from the
// rubric so the prompt and the parser never drift out of sync.
export function aiVibeCriterionKeys(): string[] {
  return allCriteria(TRACKS["ai-vibe"]).map((c) => c.key);
}
