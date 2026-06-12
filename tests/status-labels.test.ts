import { describe, it, expect } from "vitest";
import { STATUS_LABELS, statusLabel } from "@/lib/status-labels";
import { LOCALES } from "@/lib/i18n/config";
import type { ProposalStatus } from "@/lib/eval-log";

// One canonical label per status, per locale (lib/status-labels). Before this
// map, `confirmed` showed up as 승인됨 / 선정됨 / 확정됨 and `submitted` as
// 제출됨 / 검토 대기 / 확인 대기 across different screens. These tests pin the
// single source of truth so a screen can't silently reintroduce a synonym.

const ALL_STATUSES: ProposalStatus[] = [
  "draft",
  "submitted",
  "changes_requested",
  "rejected",
  "confirmed",
];

describe("STATUS_LABELS coverage", () => {
  it("defines every status in every locale", () => {
    for (const locale of LOCALES) {
      for (const status of ALL_STATUSES) {
        expect(STATUS_LABELS[locale][status], `${locale}/${status}`).toBeTruthy();
      }
    }
  });

  it("has no extra or missing status keys per locale", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(STATUS_LABELS[locale]).sort()).toEqual([...ALL_STATUSES].sort());
    }
  });
});

describe("canonical wording (pins the chosen term per state)", () => {
  it("Korean uses the agreed single term for each state", () => {
    expect(STATUS_LABELS.kr.draft).toBe("초안");
    expect(STATUS_LABELS.kr.submitted).toBe("검토 대기");
    expect(STATUS_LABELS.kr.changes_requested).toBe("수정 요청");
    expect(STATUS_LABELS.kr.rejected).toBe("선정 안 됨");
    expect(STATUS_LABELS.kr.confirmed).toBe("승인됨");
  });

  it("English uses the agreed single term for each state", () => {
    expect(STATUS_LABELS.en.draft).toBe("Draft");
    expect(STATUS_LABELS.en.submitted).toBe("In review");
    expect(STATUS_LABELS.en.changes_requested).toBe("Changes requested");
    expect(STATUS_LABELS.en.rejected).toBe("Not selected");
    expect(STATUS_LABELS.en.confirmed).toBe("Approved");
  });

  it("never reintroduces a dropped synonym for `confirmed`", () => {
    // 선정됨 (admin) and 확정됨 (priority map) were the old divergent labels.
    const confirmedLabels = LOCALES.map((l) => STATUS_LABELS[l].confirmed);
    expect(confirmedLabels).not.toContain("선정됨");
    expect(confirmedLabels).not.toContain("확정됨");
  });
});

describe("statusLabel()", () => {
  it("returns the canonical label for a known status", () => {
    expect(statusLabel("confirmed", "kr")).toBe("승인됨");
    expect(statusLabel("confirmed", "en")).toBe("Approved");
  });

  it("falls back to the draft label for an unknown status (defensive)", () => {
    // Legacy/garbage status from old data should not render blank.
    expect(statusLabel("garbage" as ProposalStatus, "kr")).toBe("초안");
    expect(statusLabel("garbage" as ProposalStatus, "en")).toBe("Draft");
  });
});
