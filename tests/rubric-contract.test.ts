import { describe, it, expect } from "vitest";
import { TRACKS, allCriteria } from "@/lib/evaluator-meta";
import { aiVibeCriterionKeys } from "@/lib/scoring";
import { EXAMPLES_POOL, CATEGORY_META } from "@/lib/examples";

// The CTR criterion keys, in rubric order. Lean 2+2 shape: the four dropped
// sub-factors (roleShift, outputQuality, systemAccess, scope) are folded into
// the kept criteria's descriptions, not scored separately.
const EXPECTED_KEYS = [
  "timeReturned",
  "strategicFit",
  "dataReadiness",
  "buildFit",
];

describe("ai-vibe rubric contract (CTR TIDA mapping)", () => {
  const track = TRACKS["ai-vibe"];

  it("keeps the impact + feasibility two-group shape, 2 criteria each", () => {
    expect(track.groups.map((g) => g.key)).toEqual(["impact", "feasibility"]);
    for (const g of track.groups) expect(g.criteria).toHaveLength(2);
  });

  it("exposes exactly the CTR criterion keys, in order", () => {
    expect(aiVibeCriterionKeys()).toEqual(EXPECTED_KEYS);
  });

  it("keeps the score-direction cues the judge prompt depends on", () => {
    const byKey = Object.fromEntries(allCriteria(track).map((c) => [c.key, c]));
    // buildFit is the inverted "higher = easier" criterion (it now folds in
    // system access + scope) — dropping the cue would silently flip Feasibility.
    expect(byKey.buildFit.desc).toMatch(/higher\s*=\s*easier|HIGHER = easier/i);
    // Every criterion must carry an explicit "Higher =" direction cue.
    expect(byKey.timeReturned.desc).toMatch(/higher\s*=/i);
    expect(byKey.strategicFit.desc).toMatch(/higher\s*=/i);
    expect(byKey.dataReadiness.desc).toMatch(/higher\s*=/i);
  });

  it("has unique keys and plain bilingual UI labels (no jargon parentheticals)", () => {
    const crits = allCriteria(track);
    expect(new Set(crits.map((c) => c.key)).size).toBe(crits.length);
    for (const c of crits) {
      expect(c.label.kr.length).toBeGreaterThan(0);
      expect(c.label.en.length).toBeGreaterThan(0);
      // Label simplicity rule (decision D1): jargon lives in desc, not labels.
      expect(c.label.kr).not.toMatch(/[()]/);
      expect(c.label.en).not.toMatch(/[()]/);
      expect(c.desc.length).toBeGreaterThan(40);
    }
  });
});

describe("CTR example pool", () => {
  it("has exactly 70 ai-vibe cards with unique ids across 8 categories", () => {
    expect(EXAMPLES_POOL).toHaveLength(70);
    expect(new Set(EXAMPLES_POOL.map((e) => e.id)).size).toBe(70);
    expect(EXAMPLES_POOL.every((e) => e.track === "ai-vibe")).toBe(true);
    const used = new Set(EXAMPLES_POOL.map((e) => e.category));
    expect(used.size).toBe(Object.keys(CATEGORY_META).length);
  });
  it("every card is bilingual and long enough to seed the coach (>= 10 chars)", () => {
    for (const e of EXAMPLES_POOL) {
      expect(e.kr.label.length).toBeGreaterThan(0);
      expect(e.en.label.length).toBeGreaterThan(0);
      expect(e.kr.text.length).toBeGreaterThanOrEqual(10);
      expect(e.en.text.length).toBeGreaterThanOrEqual(10);
    }
  });
});
