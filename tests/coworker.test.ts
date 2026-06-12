import { describe, it, expect } from "vitest";
import { coworkerKeyForDomains } from "@/lib/identity";
import { redactScoreFor, type PublicEvalLogEntry } from "@/lib/eval-log";

// Co-worker sharing: the author registers a leader/teammate on a proposal, which
// widens SCORE visibility (the proposal text was always public). These tests pin
// (1) how a registration input normalizes to an identity key, fail closed, and
// (2) that redaction honors the co-worker list without leaking to anyone else.

describe("coworkerKeyForDomains (registration input → identity key)", () => {
  it("normalizes an allowed-domain email to the author key form (single-domain: local part)", () => {
    expect(coworkerKeyForDomains("Kim.Lead@CTR.co.kr", ["ctr.co.kr"])).toBe("kim.lead");
  });
  it("keeps the full email on a multi-domain deployment (local part is ambiguous)", () => {
    expect(coworkerKeyForDomains("kim@ctr.co.kr", ["ctr.co.kr", "acme.com"])).toBe("kim@ctr.co.kr");
  });
  it("rejects a foreign-domain email", () => {
    expect(coworkerKeyForDomains("kim@gmail.com", ["ctr.co.kr"])).toBe(null);
  });
  it("accepts a bare id only on a single-domain deployment", () => {
    expect(coworkerKeyForDomains("kim", ["ctr.co.kr"])).toBe("kim");
    expect(coworkerKeyForDomains("kim", ["ctr.co.kr", "acme.com"])).toBe(null);
  });
  it("rejects malformed ids", () => {
    expect(coworkerKeyForDomains(".kim", ["ctr.co.kr"])).toBe(null);
    expect(coworkerKeyForDomains("kim lee", ["ctr.co.kr"])).toBe(null);
    expect(coworkerKeyForDomains("@ctr.co.kr", ["ctr.co.kr"])).toBe(null);
    expect(coworkerKeyForDomains("", ["ctr.co.kr"])).toBe(null);
  });
  it("fails closed with no domains configured (matches the sign-in gate)", () => {
    expect(coworkerKeyForDomains("kim@ctr.co.kr", [])).toBe(null);
    expect(coworkerKeyForDomains("kim", [])).toBe(null);
  });
});

describe("redactScoreFor honors co-workers", () => {
  const entry: PublicEvalLogEntry = {
    id: "e1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    trackId: "ai-vibe",
    author: "owner",
    coworkers: ["leader"],
    text: "seed idea",
    verdict: "Strong",
    overall: 4.2,
    quadrant: "quick-win",
    status: "confirmed",
    version: 1,
    locale: "kr",
  };

  it("shows the score to a registered co-worker", () => {
    const seen = redactScoreFor(entry, "leader", false);
    expect(seen.overall).toBe(4.2);
    expect(seen.verdict).toBe("Strong");
    expect(seen.quadrant).toBe("quick-win");
  });
  it("matches a co-worker key against a full-email viewer id (legacy key form)", () => {
    expect(redactScoreFor(entry, "leader@ctr.co.kr", false).overall).toBe(4.2);
  });
  it("still shows the score to the author and to admins", () => {
    expect(redactScoreFor(entry, "owner", false).overall).toBe(4.2);
    expect(redactScoreFor(entry, "someone-else", true).overall).toBe(4.2);
  });
  it("redacts the score (not the text) from everyone else", () => {
    const seen = redactScoreFor(entry, "stranger", false);
    expect(seen.overall).toBe(0);
    expect(seen.verdict).toBe("");
    expect(seen.quadrant).toBeUndefined();
    expect(seen.evaluation).toBeUndefined();
    expect(seen.text).toBe("seed idea");
  });
  it("never matches an empty viewer id (signed-out)", () => {
    expect(redactScoreFor(entry, "", false).overall).toBe(0);
    expect(redactScoreFor({ ...entry, coworkers: [""] }, "", false).overall).toBe(0);
  });
});
