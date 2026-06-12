"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import ScorePanel from "@/components/ScorePanel";
import { quadrantLabel, DEFAULT_QUADRANT_THRESHOLD, type QuadrantKey } from "@/lib/scoring";
import { displayAuthor } from "@/lib/identity";
import { statusLabel } from "@/lib/status-labels";
import type { Locale } from "@/lib/i18n/config";
import type { EvalResult } from "@/lib/evaluator-meta";
import type { ProposalStatus } from "@/lib/eval-log";

// The minimal slice the popup needs. The Priority Map already holds every point's
// full evaluation + proposal in memory (entries without a score never become
// points, and the list endpoints keep `proposal` even when the score is
// redacted), so opening this is a pure client-side overlay — no extra fetch.
export interface PriorityPoint {
  id: string;
  label: string;
  // All five statuses: the admin map feeds rejected/changes_requested points too.
  status: ProposalStatus;
  author: string;
  q: QuadrantKey;
  evaluation: EvalResult;
  proposal?: string;
}

// Mirror of the Priority Map's quadrant palette — theme tokens are bare RGB
// triples, so they must be wrapped in rgb() to be valid colour values.
const Q_COLOR: Record<QuadrantKey, string> = {
  "quick-win": "rgb(var(--c-success))",
  "big-bet": "rgb(var(--c-info))",
  "fill-in": "rgb(var(--c-warning))",
  "money-pit": "rgb(var(--c-danger))",
};

const STR: Record<Locale, { openFull: string; noProposal: string }> = {
  kr: {
    openFull: "상세 페이지로",
    noProposal: "아직 제안서 본문이 없습니다.",
  },
  en: {
    openFull: "Open full page",
    noProposal: "No proposal written yet.",
  },
};

// A read-only quick view of a Priority Map point. It surfaces the score + the
// one-page proposal over the map (Radix handles Esc / backdrop / focus-trap);
// editing, submitting and version history stay on the full /projects/[id] page,
// reachable via the footer link.
export default function PriorityPointDialog({
  point,
  locale,
  onClose,
  threshold = DEFAULT_QUADRANT_THRESHOLD,
}: {
  point: PriorityPoint | null;
  locale: Locale;
  onClose: () => void;
  /** Quadrant boundary, passed down to the score panel so its verdict label
   *  matches the map's recalibrated plot. */
  threshold?: number;
}) {
  const router = useRouter();
  const t = STR[locale];

  return (
    <Dialog
      open={point !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {point && (
        <DialogContent className="block max-h-[85vh] w-[min(92vw,46rem)] max-w-none overflow-y-auto border-border bg-panel p-0 text-text">
          {/* Sticky header — keeps the title + verdict in view while the proposal
              scrolls. pr-10 leaves room for the dialog's built-in close button. */}
          <div className="hairline-b sticky top-0 z-10 bg-panel/95 px-5 py-4 backdrop-blur">
            <DialogTitle className="pr-10 text-base font-semibold leading-snug text-text">
              {point.label}
            </DialogTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span style={{ color: Q_COLOR[point.q] }}>{quadrantLabel(point.q, locale)}</span>
              <span className="text-muted/60">·</span>
              <span>{statusLabel(point.status, locale)}</span>
              {point.author && (
                <>
                  <span className="text-muted/60">·</span>
                  <span className="font-mono">{displayAuthor(point.author)}</span>
                </>
              )}
            </div>
          </div>

          <div className="px-5 pb-5">
            <ScorePanel score={point.evaluation} locale={locale} threshold={threshold} compact />

            <section className="hairline-t mt-5 pt-5">
              {point.proposal ? (
                <div className="text-sm text-text/90">
                  <Markdown text={point.proposal} />
                </div>
              ) : (
                <p className="text-sm text-muted">{t.noProposal}</p>
              )}
            </section>

            <div className="mt-6 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/projects/${point.id}`)}
              >
                {t.openFull}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
