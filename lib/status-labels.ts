import type { Locale } from "./i18n/config";
import type { ProposalStatus } from "./eval-log";

// The ONE canonical label per proposal-lifecycle status, per locale. Every
// surface that shows a status to a human — history badges, the proposal status
// bar, the admin filter chips, the priority-map tooltip, the browse hub — must
// render it through `statusLabel()` so the same state never appears under two
// different names. (The review found `confirmed` rendered as 승인됨 / 선정됨 /
// 확정됨 across screens, and `submitted` as 제출됨 / 검토 대기 / 확인 대기.)
//
// Wording choices: 승인됨 (clear, positive) for the approved outcome; 선정 안 됨
// (the soft "not selected", not the harsher 반려) for the negative outcome a
// regular employee receives; 검토 대기 ("awaiting review") describes the current
// state better than 제출됨 ("submitted") for the person waiting on it.
//
// Pure data — no server-only imports (the ProposalStatus import is type-only and
// erased at build), so it is safe in both client and server bundles. Pinned by
// tests/status-labels.test.ts.

export const STATUS_LABELS: Record<Locale, Record<ProposalStatus, string>> = {
  kr: {
    draft: "초안",
    submitted: "검토 대기",
    changes_requested: "수정 요청",
    rejected: "선정 안 됨",
    confirmed: "승인됨",
  },
  en: {
    draft: "Draft",
    submitted: "In review",
    changes_requested: "Changes requested",
    rejected: "Not selected",
    confirmed: "Approved",
  },
};

export function statusLabel(status: ProposalStatus, locale: Locale): string {
  return STATUS_LABELS[locale][status] ?? STATUS_LABELS[locale].draft;
}
