"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { Locale } from "@/lib/i18n/config";
import type { EvalResult } from "@/lib/evaluator-meta";
import { quadrantKey, quadrantLabel, DEFAULT_QUADRANT_THRESHOLD } from "@/lib/scoring";
import { EASE_OUT } from "@/lib/motion";

const STR: Record<Locale, { overall: string; suggestions: string; details: string }> = {
  kr: { overall: "종합 점수", suggestions: "보완하면 좋은 점", details: "세부 점수" },
  en: { overall: "Overall", suggestions: "How to brighten it", details: "Criteria breakdown" },
};

// Squared (Swiss) bar that fills from 0 → its value on reveal. A high score
// (≥ 4) fills in gold — the precious accent rewards a strong axis; otherwise ink.
function ScoreBar({ value }: { value: number }) {
  const reduce = useReducedMotion() ?? false;
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const high = value >= 4;
  return (
    <div className="h-1 w-full overflow-hidden bg-panel2/70">
      <motion.div
        className="h-full"
        style={{ background: high ? "rgb(var(--c-accent-3) / 0.9)" : "rgb(var(--c-primary) / 0.7)" }}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      />
    </div>
  );
}

export default function ScorePanel({
  score,
  locale,
  compact = false,
  threshold = DEFAULT_QUADRANT_THRESHOLD,
}: {
  score: EvalResult;
  locale: Locale;
  compact?: boolean;
  /** Quadrant boundary for the verdict label. Defaults to the standard 3.5; the
   *  admin priority map passes the configured value so its popup label matches
   *  the recalibrated plot. */
  threshold?: number;
}) {
  const t = STR[locale];
  const [open, setOpen] = useState(!compact);

  const impact = score.groupAverages.find((g) => g.key === "impact")?.average ?? 0;
  const feasibility = score.groupAverages.find((g) => g.key === "feasibility")?.average ?? 0;
  const qLabel = quadrantLabel(quadrantKey(impact, feasibility, threshold), locale);

  return (
    <div className="hairline-t pt-5">
      {/* Hero — the magnitude is the headline; quadrant verdict sits opposite. */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="eyebrow">{t.overall}</span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="magnitude text-5xl font-semibold text-text">{score.overall.toFixed(1)}</span>
            <span className="text-sm text-muted">/ 5</span>
          </div>
        </div>
        <span className="border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs uppercase tracking-wide text-primary">
          {qLabel}
        </span>
      </div>

      {/* Impact / Feasibility — an aligned, hairline-divided stat readout. */}
      <div className="mt-4 grid grid-cols-2 divide-x divide-border/40 border-y border-border/40">
        {score.groupAverages.map((g) => (
          <div key={g.key} className="px-4 py-3 first:pl-0 last:pr-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="eyebrow">{g.label}</span>
              <span className="font-display text-base font-semibold tabular-nums text-text">
                {g.average.toFixed(1)}
              </span>
            </div>
            <div className="mt-2">
              <ScoreBar value={g.average} />
            </div>
          </div>
        ))}
      </div>

      {/* Verdict summary */}
      {score.summary && <p className="mt-4 text-sm leading-relaxed text-text/80">{score.summary}</p>}

      {/* Per-criterion breakdown — collapsible, clean aligned rows. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted transition hover:text-text"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
        {t.details}
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          {score.groupAverages.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="eyebrow">{g.label}</span>
                <span className="text-xs tabular-nums text-muted">{g.average.toFixed(1)} / 5</span>
              </div>
              <ul className="divide-y divide-border/25 border-t border-border/25">
                {score.scores
                  .filter((s) => s.groupKey === g.key)
                  .map((s) => (
                    <li key={s.criterionKey} className="py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-text/85">{s.label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-text/70">
                          {s.score}
                          <span className="text-muted">/5</span>
                        </span>
                      </div>
                      {s.rationale && (
                        <p className="mt-0.5 text-xs leading-snug text-muted">{s.rationale}</p>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions — the gold ✦ is the brand bullet for "how to brighten it". */}
      {score.suggestions.length > 0 && (
        <div className="mt-5 border-t border-border/40 pt-4">
          <div className="mb-2">
            <span className="eyebrow">{t.suggestions}</span>
          </div>
          <ul className="space-y-1.5">
            {score.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-text/85">
                <span className="select-none" style={{ color: "rgb(var(--c-accent-3))" }} aria-hidden>
                  ✦
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
