import { describe, it, expect, beforeEach } from "vitest";
import { isOverLimit, rateLimitPerHour, RATE_WINDOW_MS } from "@/lib/llm-usage";

// Pins the pure rate-limit logic: the boundary (exactly `cap` calls per window),
// the env-overridable defaults (detail 40 / score 20), and fail-safe parsing of
// a bad override. The store I/O (Neon / JSON fallback) is integration-tested by
// running the app, not here.

describe("isOverLimit", () => {
  it("allows exactly `cap` calls per window, blocks the next", () => {
    expect(isOverLimit(0, 40)).toBe(false); // first call
    expect(isOverLimit(39, 40)).toBe(false); // 40th call (39 prior)
    expect(isOverLimit(40, 40)).toBe(true); // 41st blocked
    expect(isOverLimit(100, 40)).toBe(true);
  });
});

describe("rateLimitPerHour", () => {
  const KEYS = ["RATE_LIMIT_DETAIL_PER_HOUR", "RATE_LIMIT_SCORE_PER_HOUR"];
  beforeEach(() => KEYS.forEach((k) => delete process.env[k]));

  it("defaults to detail 40 / score 20", () => {
    expect(rateLimitPerHour("detail")).toBe(40);
    expect(rateLimitPerHour("score")).toBe(20);
  });

  it("honors positive integer env overrides", () => {
    process.env.RATE_LIMIT_DETAIL_PER_HOUR = "5";
    process.env.RATE_LIMIT_SCORE_PER_HOUR = "3";
    expect(rateLimitPerHour("detail")).toBe(5);
    expect(rateLimitPerHour("score")).toBe(3);
  });

  it("falls back to the default on garbage or non-positive env", () => {
    process.env.RATE_LIMIT_DETAIL_PER_HOUR = "abc";
    process.env.RATE_LIMIT_SCORE_PER_HOUR = "0";
    expect(rateLimitPerHour("detail")).toBe(40);
    expect(rateLimitPerHour("score")).toBe(20);
  });

  it("uses a one-hour window", () => {
    expect(RATE_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
