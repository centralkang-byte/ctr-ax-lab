// Pure rubric metadata for the project evaluator — no server-only imports, so
// it is safe to import from client components AND the server-side judge.

export type Locale = "kr" | "en";
export type TrackId = "okr" | "ai-vibe";

type L = { kr: string; en: string };

export interface CriterionDef {
  key: string;
  label: L;
  /** English description used to brief the model. */
  desc: string;
}
export interface GroupDef {
  key: string;
  label: L;
  criteria: CriterionDef[];
}
export interface TrackDef {
  id: TrackId;
  name: L;
  blurb: L;
  groups: GroupDef[];
}

export const TRACKS: Record<TrackId, TrackDef> = {
  okr: {
    id: "okr",
    name: { kr: "OKR vs 할 일", en: "OKR vs To-Do" },
    blurb: {
      kr: "제출한 목표가 성과 지향적인 OKR인지, 단순한 할 일 목록인지 판정합니다.",
      en: "Judge whether a submitted objective is a real outcome-oriented OKR, or just a to-do list.",
    },
    groups: [
      {
        key: "quality",
        label: { kr: "목표 품질", en: "Objective quality" },
        criteria: [
          {
            key: "outcome",
            label: { kr: "성과 지향성", en: "Outcome orientation" },
            desc: "Describes a measurable OUTCOME or change, not merely an activity or task to complete.",
          },
          {
            key: "measurability",
            label: { kr: "측정 가능성", en: "Measurability" },
            desc: "Has concrete Key Results / metrics that make success unambiguous and verifiable.",
          },
          {
            key: "ambition",
            label: { kr: "도전성", en: "Ambition" },
            desc: "Is aspirational and meaningful — stretches the team rather than being trivially achievable.",
          },
          {
            key: "clarity",
            label: { kr: "명확성·정렬", en: "Clarity & alignment" },
            desc: "Specific, time-bound, and clearly tied to a larger goal or strategy.",
          },
        ],
      },
    ],
  },

  "ai-vibe": {
    id: "ai-vibe",
    name: { kr: "CTR AX 과제", en: "CTR AX Project" },
    blurb: {
      kr: "AI 업무 아이디어를 임팩트 x 실현가능성으로 평가하고 우선순위 사분면에 배치합니다.",
      en: "Score an AI work idea on Impact and Feasibility, then place it in a priority quadrant.",
    },
    groups: [
      {
        key: "impact",
        label: { kr: "임팩트", en: "Impact" },
        // Two criteria, deliberately lean. The old roleShift + outputQuality
        // sub-factors are folded into timeReturned's desc as value-weights, so
        // the judge still considers them without scoring them separately.
        criteria: [
          {
            key: "timeReturned",
            label: { kr: "되찾는 시간", en: "Time returned" },
            desc: "Monthly hours returned = time per occurrence (CTR TIDA 'T', target >= 30 min) x frequency (TIDA 'I', target >= weekly), normalized to hours per month. Daily/weekly heavy work scores high; quarterly/annual work scores low unless each occurrence is very large. Distinguish measured vs estimated and per-person vs org-wide totals. Weigh the VALUE of those hours up when the work climbs CTR's L1-L5 ladder (pure time-saving < human-as-reviewer < the output triggers a next action like a mail draft / approval form / alert < system write-back) AND the output is trustworthy enough for a named human verifier to sign off quickly. Higher = more hours per month returned AND a bigger, better-trusted shift from doing to reviewing (>20 h/month for one person is high).",
          },
          {
            key: "strategicFit",
            label: { kr: "전략 적합성", en: "Strategic fit" },
            desc: "Alignment with CTR's measured strategic levers: a faster, cleaner consolidated / period close, cross-division connection (the biggest bottlenecks live BETWEEN departments), reducing external service fees, or turning a division's know-how into a reusable company asset. Higher = clearly moves one of these levers.",
          },
        ],
      },
      {
        key: "feasibility",
        label: { kr: "실현가능성", en: "Feasibility" },
        // The old systemAccess + scope sub-factors are folded into buildFit's
        // desc (it keeps the inverted "higher = easier" cue the judge depends on).
        criteria: [
          {
            key: "dataReadiness",
            label: { kr: "데이터 준비도", en: "Data readiness" },
            desc: "CTR TIDA 'D': is the input data structured, and is its source system NAMED (SAP, PLM, MES, Excel, e-Accounting)? Higher = data already exists and is identified. Lower = the knowledge lives in someone's head / verbal handoffs, or the source is unnamed (a data-source interview must come first).",
          },
          {
            key: "buildFit",
            label: { kr: "도구 적합성", en: "Tool fit" },
            desc: "CTR TIDA 'A': can the business owner build this with no-code / iterative AI tooling (documents, analysis, reports), reaching the data through file/Excel export or read-only access that works TODAY, on ONE bounded repeatable use case with an obvious first 30-minute slice rather than an entire job function? Higher = easier: a non-engineer can build and iterate on a right-sized task without hitting a security gate. Lower = needs dedicated engineering or data pipelines, ERP/MES/PLM write-back, blocked shared accounts, or a giant whole-function scope (write-back deferred to a later phase).",
          },
        ],
      },
    ],
  },
};

export function allCriteria(track: TrackDef): CriterionDef[] {
  return track.groups.flatMap((g) => g.criteria);
}

export interface ScoreRow {
  groupKey: string;
  groupLabel: string;
  criterionKey: string;
  label: string;
  score: number;
  rationale: string;
}
export interface EvalResult {
  trackId: TrackId;
  verdict: string;
  summary: string;
  suggestions: string[];
  scores: ScoreRow[];
  groupAverages: { key: string; label: string; average: number }[];
  overall: number;
  quadrant?: string;
  model: string;
}
