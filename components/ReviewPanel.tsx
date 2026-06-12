"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, ShieldCheck, MessageSquare, Ban, RotateCcw, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/lib/i18n/config";
import { displayAuthor } from "@/lib/identity";

// Review surface for one proposal. Shows the append-only review history to
// everyone (so the author reads their feedback) and, for an admin reviewing a
// `submitted` proposal, a composer: an AI-draft button plus the three review
// decisions. The LLM only drafts — the admin edits and decides.

type ReviewDecision = "approved" | "changes_requested" | "rejected" | "reopened";

interface Review {
  id: string;
  version: number;
  decision: ReviewDecision;
  feedback: string;
  reviewer: string;
  createdAt: string;
}

const STR: Record<Locale, {
  history: string;
  empty: string;
  review: string;
  placeholder: string;
  aiDraft: string;
  drafting: string;
  recommended: string;
  approve: string;
  approveConfirm: string;
  approveNote: string;
  requestUpdates: string;
  reject: string;
  rejectConfirm: string;
  rejectNote: string;
  reopen: string;
  working: string;
  needFeedback: string;
  needRejectFeedback: string;
  decideFailed: string;
  by: string;
  decisions: Record<ReviewDecision, string>;
}> = {
  kr: {
    history: "검토 기록",
    empty: "아직 검토 내역이 없습니다.",
    review: "검토",
    placeholder: "작성자에게 보낼 피드백을 작성하세요…",
    aiDraft: "AI 초안",
    drafting: "작성 중…",
    recommended: "추천",
    approve: "승인",
    approveConfirm: "한 번 더 누르면 승인",
    approveNote:
      "승인하면 제안서가 영구적으로 잠기고 되돌릴 수 없습니다. 실행 단계(진척 기록)가 열리고 Teams 채널에 알림이 갑니다.",
    requestUpdates: "수정 요청",
    reject: "반려",
    rejectConfirm: "한 번 더 누르면 반려",
    rejectNote: "작성자에게 위 피드백과 함께 ‘선정 안 됨’으로 전달됩니다.",
    reopen: "재검토로 되돌리기",
    working: "처리 중…",
    needFeedback: "수정 요청에는 피드백이 필요합니다.",
    needRejectFeedback: "반려에는 사유(피드백)가 필요합니다.",
    decideFailed: "처리에 실패했습니다. 다시 시도해 주세요.",
    by: "검토자",
    decisions: {
      approved: "승인됨",
      changes_requested: "수정 요청",
      // Matches the canonical status label (lib/status-labels) so the review-
      // history event and the proposal's status read the same word.
      rejected: "선정 안 됨",
      reopened: "재검토",
    },
  },
  en: {
    history: "Review history",
    empty: "No reviews yet.",
    review: "Review",
    placeholder: "Write feedback for the author…",
    aiDraft: "AI draft",
    drafting: "Drafting…",
    recommended: "Recommended",
    approve: "Approve",
    approveConfirm: "Click again to approve",
    approveNote:
      "Approving permanently locks the proposal — it cannot be undone. The progress phase opens and the Teams channel is notified.",
    requestUpdates: "Request updates",
    reject: "Reject",
    rejectConfirm: "Click again to reject",
    rejectNote: "The author will see ‘Not selected’ along with the feedback above.",
    reopen: "Reopen to pending",
    working: "Working…",
    needFeedback: "Request updates needs feedback.",
    needRejectFeedback: "Reject needs feedback explaining why.",
    decideFailed: "The decision failed to save. Please try again.",
    by: "by",
    decisions: {
      approved: "Approved",
      changes_requested: "Changes requested",
      rejected: "Not selected",
      reopened: "Reopened",
    },
  },
};

function decisionTone(d: ReviewDecision): string {
  if (d === "approved") return "border-primary/40 bg-primary/10 text-primary";
  if (d === "rejected") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (d === "changes_requested") return "border-amber-400/40 bg-amber-400/10 text-amber-500";
  return "border-border/60 bg-panel2/40 text-muted";
}

// Pull the @@RECOMMEND marker off the first line and return the rest as the body.
function parseDraft(raw: string): { rec: ReviewDecision | null; body: string } {
  if (!raw.startsWith("@@RECOMMEND:")) return { rec: null, body: raw };
  const nl = raw.indexOf("\n");
  const markerText = (nl === -1 ? raw : raw.slice(0, nl)).slice("@@RECOMMEND:".length).trim();
  const rec: ReviewDecision | null =
    markerText.includes("approved")
      ? "approved"
      : markerText.includes("changes_requested")
        ? "changes_requested"
        : markerText.includes("rejected")
          ? "rejected"
          : null;
  const body = nl === -1 ? "" : raw.slice(nl + 1).replace(/^\n+/, "");
  return { rec, body };
}

export default function ReviewPanel({
  entryId,
  locale,
  status,
  isAdmin,
  onReviewed,
}: {
  entryId: string;
  locale: Locale;
  status: string;
  isAdmin: boolean;
  onReviewed: () => void;
}) {
  const t = STR[locale];
  const [reviews, setReviews] = useState<Review[]>([]);
  const [feedback, setFeedback] = useState("");
  const [recommended, setRecommended] = useState<ReviewDecision | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState<ReviewDecision | null>(null);
  const [decideError, setDecideError] = useState(false);
  // Approve/Reject are armed by a first click and executed by a second within
  // a short window — approve is the one permanently irreversible action in the
  // app (it locks the proposal and notifies the Teams channel), so it must not
  // be a single slip of the mouse.
  const [confirming, setConfirming] = useState<ReviewDecision | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluations/${entryId}/reviews`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { reviews?: Review[] };
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch {
      /* ignore */
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load, status]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(locale === "kr" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  async function draft() {
    if (drafting) return;
    setDrafting(true);
    setRecommended(null);
    const ctrl = new AbortController();
    draftAbort.current = ctrl;
    try {
      const res = await fetch(`/api/evaluations/${entryId}/review-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const { rec, body } = parseDraft(acc);
        if (rec) setRecommended(rec);
        setFeedback(body);
      }
    } catch {
      /* aborted or network error — leave whatever streamed in */
    } finally {
      setDrafting(false);
      draftAbort.current = null;
    }
  }

  async function decide(decision: ReviewDecision) {
    if (busy) return;
    // Both bounce-backs need a reason the author can act on — a bare
    // "수정 요청/선정 안 됨" with no feedback is the worst author experience.
    if ((decision === "changes_requested" || decision === "rejected") && !feedback.trim()) return;
    setBusy(decision);
    setDecideError(false);
    if (drafting) draftAbort.current?.abort();
    try {
      const res = await fetch(`/api/evaluations/${entryId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback: feedback.trim() }),
      });
      if (res.ok) {
        setFeedback("");
        setRecommended(null);
        await load();
        onReviewed();
      } else {
        setDecideError(true);
      }
    } catch {
      setDecideError(true);
    } finally {
      setBusy(null);
    }
  }

  // First click arms the heavy decisions (approve/reject); the second click
  // within the window executes. Switching buttons re-arms for the other one.
  function requestDecision(decision: ReviewDecision) {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirming === decision) {
      setConfirming(null);
      void decide(decision);
      return;
    }
    setConfirming(decision);
    confirmTimer.current = setTimeout(() => setConfirming(null), 6000);
  }

  const canCompose = isAdmin && status === "submitted";
  const canReopen = isAdmin && status === "rejected";

  // Nothing to show: no history and no admin actions available.
  if (reviews.length === 0 && !canCompose && !canReopen) return null;

  return (
    <section className="hairline-t space-y-4 pt-5">
      {/* ── Admin composer ─────────────────────────────────────────────────── */}
      {canCompose && (
        <div className="rounded-xl border border-border/60 bg-panel p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
              <MessageSquareText strokeWidth={1.8} className="h-4 w-4 text-primary" />
              {t.review}
            </div>
            <button
              onClick={() => void draft()}
              disabled={drafting}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-50"
            >
              <Sparkles className={`h-3.5 w-3.5 ${drafting ? "animate-pulse text-primary" : ""}`} />
              {drafting ? t.drafting : t.aiDraft}
            </button>
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            placeholder={t.placeholder}
            className="w-full resize-y rounded-lg border border-border/70 bg-panel2/40 p-3 text-sm leading-relaxed text-text outline-none focus:border-primary/50"
          />

          {recommended && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              {t.recommended}:
              <span className={`border px-1.5 py-0.5 text-xs uppercase tracking-wide ${decisionTone(recommended)}`}>
                {t.decisions[recommended]}
              </span>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => requestDecision("approved")} disabled={busy !== null}>
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {busy === "approved"
                ? t.working
                : confirming === "approved"
                  ? t.approveConfirm
                  : t.approve}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void decide("changes_requested")}
              disabled={busy !== null || !feedback.trim()}
              title={!feedback.trim() ? t.needFeedback : undefined}
            >
              <MessageSquare className="mr-1.5 h-4 w-4" />
              {busy === "changes_requested" ? t.working : t.requestUpdates}
            </Button>
            {/* Pushed away from Approve — adjacent opposite verdicts invite slips. */}
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => requestDecision("rejected")}
              disabled={busy !== null || !feedback.trim()}
              title={!feedback.trim() ? t.needRejectFeedback : undefined}
            >
              <Ban className="mr-1.5 h-4 w-4" />
              {busy === "rejected" ? t.working : confirming === "rejected" ? t.rejectConfirm : t.reject}
            </Button>
          </div>
          {/* Spell out the consequence while the decision is armed. */}
          {confirming === "approved" && <p className="mt-2 text-xs text-muted">{t.approveNote}</p>}
          {confirming === "rejected" && <p className="mt-2 text-xs text-muted">{t.rejectNote}</p>}
          {decideError && <p className="mt-2 text-xs text-destructive">{t.decideFailed}</p>}
        </div>
      )}

      {/* ── Reopen (rejected) ──────────────────────────────────────────────── */}
      {canReopen && (
        <>
          <Button variant="secondary" onClick={() => void decide("reopened")} disabled={busy !== null}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            {busy === "reopened" ? t.working : t.reopen}
          </Button>
          {decideError && <p className="text-xs text-destructive">{t.decideFailed}</p>}
        </>
      )}

      {/* ── Review history ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
          <MessageSquareText strokeWidth={1.8} className="h-4 w-4 text-primary" />
          {t.history}
          {reviews.length > 0 && (
            <span className="text-xs font-normal text-muted">({reviews.length})</span>
          )}
        </div>
        {reviews.length === 0 ? (
          <p className="text-xs text-muted">{t.empty}</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-border/60 bg-panel2/40 p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className={`border px-1.5 py-0.5 uppercase tracking-wide ${decisionTone(r.decision)}`}>
                    {t.decisions[r.decision]}
                  </span>
                  <span className="tabular-nums">v{r.version}</span>
                  {r.reviewer && (
                    <span>
                      {t.by} {displayAuthor(r.reviewer)}
                    </span>
                  )}
                  <span className="tabular-nums">{fmtTime(r.createdAt)}</span>
                </div>
                {r.feedback && (
                  <div className="text-sm text-text/85">
                    <Markdown text={r.feedback} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
