import { describe, it, expect } from "vitest";
import {
  quadrantKey,
  clampSubmitThreshold,
  clampQuadrantThreshold,
  DEFAULT_QUADRANT_THRESHOLD,
  QUADRANT_THRESHOLD_MIN,
  QUADRANT_THRESHOLD_MAX,
  DEFAULT_SUBMIT_THRESHOLD,
  SUBMIT_THRESHOLD_MIN,
  SUBMIT_THRESHOLD_MAX,
} from "@/lib/scoring";

describe("quadrant placement", () => {
  it("maps the four quadrants around the threshold", () => {
    expect(quadrantKey(4, 4)).toBe("quick-win");
    expect(quadrantKey(4, 3)).toBe("big-bet");
    expect(quadrantKey(3, 4)).toBe("fill-in");
    expect(quadrantKey(3, 3)).toBe("money-pit");
  });
  it("treats the threshold itself as high (boundary inclusive)", () => {
    expect(quadrantKey(DEFAULT_QUADRANT_THRESHOLD, DEFAULT_QUADRANT_THRESHOLD)).toBe("quick-win");
  });
});

describe("quadrant threshold (admin-configurable boundary)", () => {
  it("uses a custom threshold to decide 'high' on each axis", () => {
    // At a 3.0 boundary a 3.0/3.0 idea is a Quick Win (Money Pit at the 3.5 default).
    expect(quadrantKey(3, 3, 3)).toBe("quick-win");
    expect(quadrantKey(3, 2.5, 3)).toBe("big-bet");
    // At a 4.0 boundary a 3.5/3.5 idea drops out of the high quadrants.
    expect(quadrantKey(3.5, 3.5, 4)).toBe("money-pit");
    expect(quadrantKey(4, 4, 4)).toBe("quick-win");
  });
  it("defaults to 3.5 when no threshold is passed", () => {
    expect(quadrantKey(3.5, 3.5)).toBe("quick-win");
    expect(quadrantKey(3.4, 3.4)).toBe("money-pit");
  });
});

describe("clampQuadrantThreshold", () => {
  it("rounds to 0.5 steps and clamps to [2.5, 4.5]", () => {
    expect(clampQuadrantThreshold(3.3)).toBe(3.5);
    expect(clampQuadrantThreshold(9)).toBe(QUADRANT_THRESHOLD_MAX);
    expect(clampQuadrantThreshold(0)).toBe(QUADRANT_THRESHOLD_MIN);
  });
  it("falls back to the default on garbage input", () => {
    expect(clampQuadrantThreshold("x")).toBe(DEFAULT_QUADRANT_THRESHOLD);
    expect(clampQuadrantThreshold(undefined)).toBe(DEFAULT_QUADRANT_THRESHOLD);
  });
});

describe("submit threshold (gate for decision D8)", () => {
  it("accepts the pilot month-1 minimum — everything may submit", () => {
    expect(clampSubmitThreshold(0)).toBe(SUBMIT_THRESHOLD_MIN);
  });
  it("rounds to 0.5 steps and clamps to [0, 5]", () => {
    expect(clampSubmitThreshold(3.4)).toBe(3.5);
    expect(clampSubmitThreshold(9)).toBe(SUBMIT_THRESHOLD_MAX);
    expect(clampSubmitThreshold(-1)).toBe(SUBMIT_THRESHOLD_MIN);
  });
  it("falls back to the default on garbage input", () => {
    expect(clampSubmitThreshold("x")).toBe(DEFAULT_SUBMIT_THRESHOLD);
    expect(clampSubmitThreshold(undefined)).toBe(DEFAULT_SUBMIT_THRESHOLD);
  });
});
