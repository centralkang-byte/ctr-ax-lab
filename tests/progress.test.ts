import { describe, it, expect } from "vitest";
import { canPostProgress, canCommentProgress, isStale, reduceOverview } from "@/lib/progress-log";

// Progress-feed permissions: updates are written by the people running the
// project (author + registered co-workers); feedback comments add admins.
// Reading is company-wide and isn't gated by these helpers.

const ENTRY = { submitter: "owner", coworkers: ["leader"] };

describe("canPostProgress (who may post an update)", () => {
  it("author and registered co-worker may post", () => {
    expect(canPostProgress(ENTRY, "owner")).toBe(true);
    expect(canPostProgress(ENTRY, "leader")).toBe(true);
  });
  it("matches identity keys against full-email viewer ids (legacy key form)", () => {
    expect(canPostProgress(ENTRY, "owner@ctr.co.kr")).toBe(true);
    expect(canPostProgress(ENTRY, "leader@ctr.co.kr")).toBe(true);
  });
  it("anyone else may not — including admins (their channel is comments)", () => {
    expect(canPostProgress(ENTRY, "stranger")).toBe(false);
  });
  it("never matches a signed-out (empty) viewer", () => {
    expect(canPostProgress(ENTRY, "")).toBe(false);
    expect(canPostProgress({ submitter: "", coworkers: [] }, "")).toBe(false);
  });
  it("legacy entries with no submitter stay open to any signed-in user", () => {
    expect(canPostProgress({ submitter: "", coworkers: [] }, "anyone")).toBe(true);
  });
});

describe("canCommentProgress (who may leave feedback)", () => {
  it("admins may comment even when they can't post", () => {
    expect(canCommentProgress(ENTRY, "admin-user", true)).toBe(true);
    expect(canPostProgress(ENTRY, "admin-user")).toBe(false);
  });
  it("author and co-workers may comment (reply to feedback)", () => {
    expect(canCommentProgress(ENTRY, "owner", false)).toBe(true);
    expect(canCommentProgress(ENTRY, "leader", false)).toBe(true);
  });
  it("everyone else may not", () => {
    expect(canCommentProgress(ENTRY, "stranger", false)).toBe(false);
    expect(canCommentProgress(ENTRY, "", false)).toBe(false);
  });
});

describe("isStale (admin-board nudge after 14 quiet days)", () => {
  const NOW = "2026-06-15T00:00:00.000Z";
  it("flags a project past the threshold, not one within it", () => {
    expect(isStale("2026-05-31T00:00:00.000Z", NOW)).toBe(true); // 15 days
    expect(isStale("2026-06-02T00:00:00.000Z", NOW)).toBe(false); // 13 days
  });
  it("treats missing or unparseable activity as stale (attract attention, don't hide)", () => {
    expect(isStale(undefined, NOW)).toBe(true);
    expect(isStale("not-a-date", NOW)).toBe(true);
  });
});

describe("reduceOverview (newest-first roll-up per project)", () => {
  it("keeps the latest stage and the most recent reported hours", () => {
    const rows = reduceOverview([
      { evaluationId: "a", stage: "done", hoursReturned: 12, createdAt: "2026-06-10T00:00:00.000Z" },
      { evaluationId: "b", stage: "blocked", hoursReturned: undefined, createdAt: "2026-06-09T00:00:00.000Z" },
      { evaluationId: "a", stage: "on_track", hoursReturned: 8, createdAt: "2026-06-01T00:00:00.000Z" },
    ]);
    const a = rows.find((r) => r.evaluationId === "a")!;
    expect(a.updateCount).toBe(2);
    expect(a.lastStage).toBe("done");
    expect(a.lastUpdateAt).toBe("2026-06-10T00:00:00.000Z");
    expect(a.hoursReturned).toBe(12); // latest report wins — values don't sum
    const b = rows.find((r) => r.evaluationId === "b")!;
    expect(b.updateCount).toBe(1);
    expect(b.hoursReturned).toBeUndefined();
  });
});
