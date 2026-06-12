"use client";

import { useEffect, useState } from "react";
import { FileText, Copy, Check, Pencil, X, RefreshCw, Lock, Clock, MessageSquare, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import ScorePanel from "@/components/ScorePanel";
import ReviewPanel from "@/components/ReviewPanel";
import VersionHistory from "@/components/VersionHistory";
import CoworkerPanel from "@/components/CoworkerPanel";
import ProgressPanel from "@/components/ProgressPanel";
import type { Locale } from "@/lib/i18n/config";
import type { PublicEvalLogEntry } from "@/lib/eval-log";
import { DEFAULT_SUBMIT_THRESHOLD, DEFAULT_QUADRANT_THRESHOLD } from "@/lib/scoring";
import { statusLabel } from "@/lib/status-labels";
import { sameUser, displayAuthor } from "@/lib/identity";

const STR: Record<Locale, {
  proposal: string;
  copy: string;
  copied: string;
  edit: string;
  save: string;
  cancel: string;
  scoring: string;
  rescore: string;
  submit: string;
  resubmit: string;
  submitting: string;
  submitGate: (n: number) => string;
  submitLocked: string;
  submitForbidden: string;
  submitFailed: string;
  editFailed: string;
  confirmedNote: string;
  changesRequestedNote: string;
  rejectedNote: string;
  version: string;
}> = {
  kr: {
    proposal: "프로젝트 제안서 (한 장)",
    copy: "복사",
    copied: "복사됨",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    scoring: "채점 중…",
    rescore: "다시 채점",
    submit: "제출",
    resubmit: "다시 제출",
    submitting: "제출 중…",
    submitGate: (n: number) => `제출하려면 종합 ${n}점 이상이 필요합니다.`,
    submitLocked: "이미 승인된 제안서라 변경할 수 없습니다.",
    submitForbidden: "본인의 제안서만 제출할 수 있습니다.",
    submitFailed: "제출에 실패했습니다. 다시 시도해 주세요.",
    editFailed: "저장에 실패했습니다. 작성한 내용은 그대로 남아 있으니 다시 시도해 주세요.",
    confirmedNote: "관리자가 승인했습니다. 더 이상 수정할 수 없습니다.",
    changesRequestedNote: "관리자가 수정을 요청했습니다. 아래 피드백을 반영해 다시 제출하세요.",
    rejectedNote: "이 제안서는 선정되지 않았습니다.",
    version: "버전",
  },
  en: {
    proposal: "Project proposal (one-pager)",
    copy: "Copy",
    copied: "Copied",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    scoring: "Scoring…",
    rescore: "Re-score",
    submit: "Submit",
    resubmit: "Re-submit",
    submitting: "Submitting…",
    submitGate: (n: number) => `Needs an overall score of ${n}+ to submit.`,
    submitLocked: "Already approved — it can no longer be changed.",
    submitForbidden: "Only the author can submit this proposal.",
    submitFailed: "Submit failed. Please try again.",
    editFailed: "Save failed. Your text is still here — please try again.",
    confirmedNote: "An admin has approved this. It can no longer be changed.",
    changesRequestedNote: "An admin requested changes. Address the feedback below and re-submit.",
    rejectedNote: "This proposal wasn't selected.",
    version: "version",
  },
};

function extractTitle(proposal: string, fallback: string): string {
  for (const raw of proposal.split("\n")) {
    const line = raw.trim();
    if (/^#\s+/.test(line)) return line.replace(/^#\s+/, "").slice(0, 120);
    if (line) break;
  }
  return fallback.slice(0, 120);
}

export default function ProposalDetail({
  initial,
  locale,
  me,
  isAdmin,
  hideScore = false,
}: {
  initial: PublicEvalLogEntry;
  locale: Locale;
  me: string;
  isAdmin: boolean;
  hideScore?: boolean;
}) {
  const t = STR[locale];
  const [entry, setEntry] = useState<PublicEvalLogEntry>(initial);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Admin-configured submit gate (server enforces; this keeps the button in sync).
  const [threshold, setThreshold] = useState(DEFAULT_SUBMIT_THRESHOLD);
  // Admin-configured quadrant boundary — keeps this proposal's verdict label in
  // step with the priority map when the admin moves the threshold.
  const [quadrantThreshold, setQuadrantThreshold] = useState(DEFAULT_QUADRANT_THRESHOLD);
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (typeof d.submitThreshold === "number") setThreshold(d.submitThreshold);
        if (typeof d.quadrantThreshold === "number") setQuadrantThreshold(d.quadrantThreshold);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const isOwner = !entry.author || sameUser(entry.author, me);
  const locked = entry.status === "confirmed";
  const canEdit = isOwner && !locked;

  async function reload() {
    try {
      const res = await fetch(`/api/evaluations/${entry.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { entry?: PublicEvalLogEntry };
      if (data.entry) setEntry(data.entry);
    } catch {
      /* ignore */
    }
  }

  // Re-score the entry server-side. The server grades the entry's OWN stored
  // proposal and persists the result — the client neither supplies nor stores
  // the score (closes the submit-gate bypass). Call AFTER any proposal edit has
  // been saved so the server scores the new text.
  async function rescore() {
    setScoring(true);
    try {
      await fetch(`/api/evaluations/${entry.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
    } catch {
      /* ignore — reload below reflects whatever persisted */
    } finally {
      setScoring(false);
      await reload();
    }
  }

  async function saveEdit() {
    const v = editText.trim();
    if (!v || savingEdit) return;
    // The editor stays open until the PATCH succeeds — closing it optimistically
    // on a failed save would silently throw away the user's hand-edited text.
    setSavingEdit(true);
    setEditError(false);
    try {
      const res = await fetch(`/api/evaluations/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: v, title: extractTitle(v, entry.text) }),
      });
      if (!res.ok) {
        setEditError(true);
        return;
      }
      setEditing(false);
      await reload();
      void rescore(); // a hand-edit is a new revision — re-grade the saved text
    } catch {
      setEditError(true);
    } finally {
      setSavingEdit(false);
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/evaluations/${entry.id}/submit`, { method: "POST" });
      if (res.ok) {
        await reload();
      } else {
        // The server's refusals are meaningful (threshold drift, lock, owner
        // mismatch) — translate them instead of swallowing them.
        const data = (await res.json().catch(() => null)) as
          | { error?: string; threshold?: number }
          | null;
        setSubmitError(
          data?.error === "below_threshold"
            ? t.submitGate(typeof data.threshold === "number" ? data.threshold : threshold)
            : data?.error === "locked"
              ? t.submitLocked
              : data?.error === "forbidden"
                ? t.submitForbidden
                : t.submitFailed
        );
      }
    } catch {
      setSubmitError(t.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyProposal() {
    if (!entry.proposal) return;
    try {
      await navigator.clipboard.writeText(entry.proposal);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      {/* Floating action bar — pins to the top of the scroll pane so the owner can
          (re-)submit without scrolling past the score. Admin review lives in the
          ReviewPanel below. */}
      {entry.proposal &&
        isOwner &&
        (entry.status === "draft" || entry.status === "changes_requested") && (
          <div className="sticky top-0 z-20 -mt-1 flex flex-wrap items-center gap-2 border-b border-border/40 bg-bg/85 py-2.5 backdrop-blur">
            <Button onClick={submit} disabled={submitting || (entry.overall ?? 0) < threshold}>
              {submitting
                ? t.submitting
                : entry.status === "changes_requested"
                  ? t.resubmit
                  : t.submit}
            </Button>
            {(entry.overall ?? 0) < threshold && (
              <span className="text-xs text-muted">{t.submitGate(threshold)}</span>
            )}
            {submitError && <span className="text-xs text-destructive">{submitError}</span>}
          </div>
        )}

      {/* Status bar — the label comes from the shared statusLabel() so it reads
          identically to the history badges / admin chips / priority map. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {entry.status === "confirmed" ? (
          <span className="inline-flex items-center gap-1 border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-wide font-medium text-primary">
            <Lock className="h-3 w-3" /> {statusLabel(entry.status, locale)}
          </span>
        ) : entry.status === "changes_requested" ? (
          <span className="inline-flex items-center gap-1 border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs uppercase tracking-wide font-medium text-amber-500">
            <MessageSquare className="h-3 w-3" /> {statusLabel(entry.status, locale)}
          </span>
        ) : entry.status === "rejected" ? (
          <span className="inline-flex items-center gap-1 border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs uppercase tracking-wide font-medium text-destructive">
            <Ban className="h-3 w-3" /> {statusLabel(entry.status, locale)}
          </span>
        ) : entry.status === "submitted" ? (
          <span className="inline-flex items-center gap-1 border border-border/60 bg-panel2/40 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
            <Clock className="h-3 w-3" /> {statusLabel(entry.status, locale)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 border border-border/60 bg-panel2/40 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
            {statusLabel("draft", locale)}
          </span>
        )}
        <span className="text-muted">
          {t.version} {entry.version}
        </span>
        {entry.author && <span className="text-muted">· {displayAuthor(entry.author)}</span>}
      </div>

      {/* Co-workers — the author shares the project with a leader/teammate.
          Stays editable after confirm (sharing is metadata, not content). */}
      <CoworkerPanel
        entryId={entry.id}
        locale={locale}
        coworkers={entry.coworkers}
        canManage={isOwner}
        onChanged={reload}
      />

      {/* Score */}
      {!hideScore && (
        scoring ? (
          <div className="hairline-t shimmer-text pt-4 text-sm">{t.scoring}</div>
        ) : entry.evaluation ? (
          <ScorePanel score={entry.evaluation} locale={locale} threshold={quadrantThreshold} compact />
        ) : null
      )}

      {locked && (
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          {t.confirmedNote}
          {entry.confirmedBy ? ` (${entry.confirmedBy})` : ""}
        </p>
      )}

      {entry.status === "changes_requested" && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-500">
          {t.changesRequestedNote}
        </p>
      )}

      {entry.status === "rejected" && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {t.rejectedNote}
        </p>
      )}

      {/* Admin review composer + everyone's read-only feedback history. */}
      <ReviewPanel
        entryId={entry.id}
        locale={locale}
        status={entry.status}
        isAdmin={isAdmin}
        onReviewed={reload}
      />

      {/* Execution-phase progress feed — only once the project is approved. */}
      {entry.status === "confirmed" && <ProgressPanel entryId={entry.id} locale={locale} />}

      {/* Proposal — view / edit */}
      {entry.proposal && (
        <section className="hairline-t pt-5">
          <div className="hairline-b mb-3 flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5">
              <FileText strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
              <span className="eyebrow">{t.proposal}</span>
            </div>
            {!editing && (
              <div className="flex items-center gap-1">
                <button
                  onClick={copyProposal}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t.copied : t.copy}
                </button>
                {canEdit && (
                  <>
                    <button
                      onClick={() => {
                        setEditText(entry.proposal ?? "");
                        setEditError(false);
                        setEditing(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t.edit}
                    </button>
                    <button
                      onClick={() => void rescore()}
                      disabled={scoring}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {t.rescore}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {editing ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={18}
                className="w-full resize-y rounded-lg border border-border/70 bg-panel p-3 font-mono text-xs leading-relaxed text-text outline-none focus:border-primary/50"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                {editError && <span className="mr-auto text-xs text-destructive">{t.editFailed}</span>}
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditError(false); }} disabled={savingEdit}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  {t.cancel}
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={!editText.trim() || savingEdit}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t.save}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text/90">
              <Markdown text={entry.proposal} />
            </div>
          )}
        </section>
      )}

      {/* Version history */}
      <VersionHistory
        entryId={entry.id}
        locale={locale}
        currentProposal={entry.proposal ?? ""}
        canRestore={canEdit}
        onRestored={reload}
      />
    </div>
  );
}
