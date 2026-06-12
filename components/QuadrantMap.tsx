"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Locale } from "@/lib/i18n/config";
import type { EvalResult } from "@/lib/evaluator-meta";
import type { ProposalStatus } from "@/lib/eval-log";
import { statusLabel } from "@/lib/status-labels";
import { quadrantKey, quadrantLabel, DEFAULT_QUADRANT_THRESHOLD, type QuadrantKey } from "@/lib/scoring";
import { displayAuthor } from "@/lib/identity";
import PriorityPointDialog from "@/components/PriorityPointDialog";

// ── Types ──────────────────────────────────────────────────────────────────
// Minimal shape we read from GET /api/evaluations (PublicEvalLogEntry). We need
// the axes (impact/feasibility live in evaluation.groupAverages) and headline
// number to plot, plus the full evaluation + proposal so the click-to-open quick
// view is a pure client-side overlay (no per-point fetch). The list endpoints
// keep `proposal` even when the score is redacted.
interface ListEntry {
  id: string;
  title?: string;
  text: string;
  overall: number;
  // The admin feed (/api/admin/history) returns every non-draft status, so this
  // must cover all five — not just draft/submitted/confirmed — or rejected and
  // changes_requested points render with a blank status label.
  status: ProposalStatus;
  // The public list exposes `author` (submitter stripped); the admin list keeps
  // the raw `submitter` (it's admin-gated). Read either so the author shows on
  // both surfaces.
  author?: string;
  submitter?: string;
  createdAt: string;
  proposal?: string;
  evaluation?: EvalResult;
}

interface Point {
  id: string;
  label: string;
  impact: number;
  feasibility: number;
  overall: number;
  status: ListEntry["status"];
  author: string;
  createdAt: string;
  q: QuadrantKey;
  // Carried through so the quick view can render without a round trip. evaluation
  // is always present (points without a score are filtered out in toPoints).
  evaluation: EvalResult;
  proposal?: string;
  /** plot position in %, top-left origin, already jittered */
  x: number;
  y: number;
}

type SortKey = "date" | "score" | "person";

// Semantic colour per quadrant. The theme tokens are bare RGB triples, so they
// must be wrapped in rgb() to be valid colour values (resolve in light/dark).
const Q_COLOR: Record<QuadrantKey, string> = {
  "quick-win": "rgb(var(--c-success))",
  "big-bet": "rgb(var(--c-info))",
  "fill-in": "rgb(var(--c-warning))",
  "money-pit": "rgb(var(--c-danger))",
};

const STR: Record<
  Locale,
  {
    title: string;
    blurb: string;
    impact: string;
    feasibility: string;
    low: string;
    high: string;
    empty: string;
    listEmpty: string;
    unscored: (n: number) => string;
    scored: (n: number) => string;
    ideas: string;
    sortDate: string;
    sortScore: string;
    sortPerson: string;
  }
> = {
  kr: {
    title: "우선순위 맵",
    blurb: "모든 아이디어를 임팩트 × 실현가능성 사분면에 배치합니다. 점이나 목록 항목을 클릭하면 상세 내용이 열립니다.",
    impact: "임팩트",
    feasibility: "실현가능성",
    low: "낮음",
    high: "높음",
    empty: "아직 점수가 매겨진 아이디어가 없습니다. 먼저 제안서를 평가해 보세요.",
    listEmpty: "표시할 아이디어가 없습니다.",
    unscored: (n) => `점수 없는 초안 ${n}개는 표시되지 않습니다`,
    scored: (n) => `아이디어 ${n}개`,
    ideas: "아이디어",
    sortDate: "날짜",
    sortScore: "점수",
    sortPerson: "작성자",
  },
  en: {
    title: "Priority Map",
    blurb: "Every idea placed on the Impact × Feasibility quadrant. Click a point or list row to open it.",
    impact: "Impact",
    feasibility: "Feasibility",
    low: "Low",
    high: "High",
    empty: "No scored ideas yet. Score a proposal first and it will appear here.",
    listEmpty: "No ideas to show.",
    unscored: (n) => `${n} unscored draft${n === 1 ? "" : "s"} hidden`,
    scored: (n) => `${n} idea${n === 1 ? "" : "s"}`,
    ideas: "Ideas",
    sortDate: "Date",
    sortScore: "Score",
    sortPerson: "Person",
  },
};

// 1–5 axis → 0–100% within the plot. Impact is the Y axis and inverted so high
// impact sits at the top. A small deterministic jitter (seeded by id) spreads
// out points that land on identical coarse scores.
function hashJitter(id: string): { jx: number; jy: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h >>> 0) % 1000) / 1000; // 0..1
  const b = (((h >>> 10) >>> 0) % 1000) / 1000;
  return { jx: (a - 0.5) * 5.5, jy: (b - 0.5) * 5.5 };
}

function toPoints(entries: ListEntry[], locale: Locale, threshold: number): Point[] {
  const pts: Point[] = [];
  for (const e of entries) {
    const groups = e.evaluation?.groupAverages;
    if (!groups) continue;
    const impact = groups.find((g) => g.key === "impact")?.average ?? 0;
    const feasibility = groups.find((g) => g.key === "feasibility")?.average ?? 0;
    if (!impact || !feasibility) continue;
    const { jx, jy } = hashJitter(e.id);
    const x = Math.min(97, Math.max(3, ((feasibility - 1) / 4) * 100 + jx));
    const y = Math.min(97, Math.max(3, ((5 - impact) / 4) * 100 + jy));
    pts.push({
      id: e.id,
      label: e.title?.trim() || e.text.slice(0, 48),
      impact,
      feasibility,
      overall: e.overall,
      status: e.status,
      author: e.author || e.submitter || "",
      createdAt: e.createdAt,
      q: quadrantKey(impact, feasibility, threshold),
      evaluation: e.evaluation!,
      proposal: e.proposal,
      x,
      y,
    });
  }
  return pts;
}

export default function QuadrantMap({
  locale,
  endpoint = "/api/evaluations",
}: {
  locale: Locale;
  /** List endpoint returning `{ entries }`. Defaults to the public list; the
   *  admin surface passes /api/admin/history for all-user, all-status coverage. */
  endpoint?: string;
}) {
  const t = STR[locale];
  const [entries, setEntries] = useState<ListEntry[] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // The point whose quick-view popup is open (null = closed).
  const [selected, setSelected] = useState<Point | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // The admin-configured quadrant boundary. Fetched from /api/config so moving
  // the threshold in admin settings re-places every point + the divider lines
  // here without a redeploy. Defaults to the standard 3.5 until it loads.
  const [threshold, setThreshold] = useState(DEFAULT_QUADRANT_THRESHOLD);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(locale === "kr" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    let alive = true;
    fetch(endpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => {
        if (alive) setEntries(Array.isArray(d.entries) ? d.entries : []);
      })
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [endpoint]);

  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && typeof d?.quadrantThreshold === "number") setThreshold(d.quadrantThreshold);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const points = useMemo(
    () => (entries ? toPoints(entries, locale, threshold) : []),
    [entries, locale, threshold]
  );
  const unscored = (entries?.length ?? 0) - points.length;

  const sortedPoints = useMemo(() => {
    const arr = [...points];
    const dir = sortDir === "desc" ? -1 : 1;
    arr.sort((a, b) => {
      if (sortBy === "score") return (a.overall - b.overall) * dir;
      if (sortBy === "date") {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
      return (a.author ?? "").localeCompare(b.author ?? "") * dir;
    });
    return arr;
  }, [points, sortBy, sortDir]);

  // Divider line position as a % of the axis (3.5 on a 1–5 scale → 62.5%).
  const threshPct = ((threshold - 1) / 4) * 100;

  // The four corner labels: [key, top%, left%, alignment]
  const corners: { q: QuadrantKey; top: string; left: string; align: string }[] = [
    { q: "big-bet", top: "0.5rem", left: "0.5rem", align: "text-left" },
    { q: "quick-win", top: "0.5rem", left: "auto", align: "text-right" },
    { q: "money-pit", top: "auto", left: "0.5rem", align: "text-left" },
    { q: "fill-in", top: "auto", left: "auto", align: "text-right" },
  ];

  return (
    <div className="w-full">
      <p className="mb-5 max-w-prose text-sm text-muted">{t.blurb}</p>

      <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-8 lg:flex-row lg:items-start">
        {/* ── Map column ──────────────────────────────────────────────────────
            The plot is a square, so its width also sets its height. Fixing the
            width keeps it within the viewport height rather than letting it grow
            unbounded on wide screens. */}
        <div className="w-full min-w-0 lg:w-[40rem] lg:shrink-0">
          {/* Legend + counts */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span className="tabular-nums">{t.scored(points.length)}</span>
            {(["quick-win", "big-bet", "fill-in", "money-pit"] as QuadrantKey[]).map((q) => (
              <span key={q} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: Q_COLOR[q] }}
                />
                {quadrantLabel(q, locale)}
              </span>
            ))}
            {unscored > 0 && <span className="text-muted/70">· {t.unscored(unscored)}</span>}
          </div>

          {/* Plot with axis gutters */}
          <div className="flex gap-2">
            {/* Y axis label */}
            <div className="flex w-5 shrink-0 items-center justify-center">
              <span className="-rotate-90 whitespace-nowrap text-xs font-medium uppercase tracking-wider text-muted">
                {t.impact}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="relative aspect-square w-full border border-border/60 bg-panel/40"
                onMouseLeave={() => setHovered(null)}
              >
            {/* Threshold dividers */}
            <div
              className="absolute inset-y-0 border-l border-dashed border-border/50"
              style={{ left: `${threshPct}%` }}
            />
            <div
              className="absolute inset-x-0 border-t border-dashed border-border/50"
              style={{ top: `${100 - threshPct}%` }}
            />

            {/* Corner quadrant labels */}
            {corners.map((c) => (
              <span
                key={c.q}
                className={`pointer-events-none absolute text-xs font-medium uppercase tracking-wide ${c.align}`}
                style={{
                  top: c.top,
                  bottom: c.top === "auto" ? "0.5rem" : "auto",
                  left: c.left,
                  right: c.left === "auto" ? "0.5rem" : "auto",
                  color: Q_COLOR[c.q],
                  opacity: 0.55,
                }}
              >
                {quadrantLabel(c.q, locale)}
              </span>
            ))}

            {/* Empty state */}
            {entries && points.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted">
                {entries === null ? "" : t.empty}
              </div>
            )}

            {/* Points */}
            {points.map((p) => {
              const isHover = hovered === p.id;
              const tooltipRight = p.x > 62;
              const tooltipBelow = p.y < 24;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  onMouseEnter={() => setHovered(p.id)}
                  onFocus={() => setHovered(p.id)}
                  title={`${p.label} — ${t.impact} ${p.impact} / ${t.feasibility} ${p.feasibility}`}
                  // p-2 enlarges the click/hover hit area well beyond the ~10px dot so a
                  // slightly-off click still opens the detail. The dot stays centered in the
                  // padded button, and the tooltip's 50%-based offsets remain anchored to it.
                  className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-2 outline-none"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: isHover ? 30 : 10 }}
                >
                  <motion.span
                    layout
                    className={`block rounded-full ring-offset-1 transition-transform group-hover:scale-150 group-focus-visible:ring-2 ${
                      isHover ? "scale-150" : ""
                    }`}
                    style={{
                      width: p.status === "confirmed" ? 13 : 10,
                      height: p.status === "confirmed" ? 13 : 10,
                      background: Q_COLOR[p.q],
                      opacity: p.status === "draft" ? 0.55 : 1,
                      boxShadow: p.status === "confirmed" ? `0 0 0 2px rgb(var(--c-bg)), 0 0 0 3px ${Q_COLOR[p.q]}` : undefined,
                    }}
                  />
                  {isHover && (
                    <div
                      className="absolute z-40 w-52 border border-border/70 bg-panel p-2.5 text-left shadow-lg"
                      style={{
                        left: tooltipRight ? "auto" : "calc(50% + 10px)",
                        right: tooltipRight ? "calc(50% + 10px)" : "auto",
                        top: tooltipBelow ? "calc(50% + 10px)" : "auto",
                        bottom: tooltipBelow ? "auto" : "calc(50% + 10px)",
                      }}
                    >
                      <div className="line-clamp-2 text-xs font-semibold text-text">{p.label}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span style={{ color: Q_COLOR[p.q] }}>{quadrantLabel(p.q, locale)}</span>
                        <span className="text-muted/60">·</span>
                        <span>{statusLabel(p.status, locale)}</span>
                        {p.author && (
                          <>
                            <span className="text-muted/60">·</span>
                            <span className="font-mono">{displayAuthor(p.author)}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-1.5 grid grid-cols-3 gap-1 text-xs tabular-nums">
                        <span className="text-muted">{t.impact}</span>
                        <span className="text-muted">{t.feasibility}</span>
                        <span className="text-muted">★</span>
                        <span className="text-text/80">{p.impact}</span>
                        <span className="text-text/80">{p.feasibility}</span>
                        <span className="text-text/80">{p.overall}</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

              {/* X axis ticks + label */}
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                <span>{t.low}</span>
                <span className="font-medium uppercase tracking-wider">{t.feasibility} →</span>
                <span>{t.high}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Idea list (sortable) — grows to fill the remaining width ─────── */}
        <aside className="w-full lg:flex-1">
          <div className="hairline-b mb-2 flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="eyebrow">{t.ideas}</span>
              <span className="text-xs tabular-nums text-muted">({points.length})</span>
            </div>
            <div className="flex items-center gap-0.5">
              {(["date", "score", "person"] as SortKey[]).map((key) => {
                const labels: Record<SortKey, string> = {
                  date: t.sortDate,
                  score: t.sortScore,
                  person: t.sortPerson,
                };
                const active = sortBy === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSort(key)}
                    className={`px-1.5 py-0.5 text-xs transition ${
                      active ? "text-text" : "text-muted hover:text-text"
                    }`}
                  >
                    {labels[key]}
                    {active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {points.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t.listEmpty}</p>
          ) : (
            <ul className="max-h-[calc(100vh-18rem)] divide-y divide-border/40 overflow-y-auto scrollbar-show">
              {sortedPoints.map((p) => {
                const isHover = hovered === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      onMouseEnter={() => setHovered(p.id)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(p.id)}
                      onBlur={() => setHovered(null)}
                      className={`group block w-full px-2 py-2.5 text-left transition-colors ${
                        isHover ? "bg-panel2/40" : "hover:bg-panel2/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: Q_COLOR[p.q], opacity: p.status === "draft" ? 0.55 : 1 }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-xs font-medium text-text decoration-primary/40 underline-offset-2 group-hover:underline">
                            {p.label}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <span className="font-semibold tabular-nums text-text/80">
                              {p.overall.toFixed(1)}
                            </span>
                            <span style={{ color: Q_COLOR[p.q] }}>{quadrantLabel(p.q, locale)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted/80">
                            <span className="truncate font-mono">{displayAuthor(p.author) || "—"}</span>
                            <span className="shrink-0 tabular-nums">{fmtTime(p.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <PriorityPointDialog point={selected} locale={locale} threshold={threshold} onClose={() => setSelected(null)} />
    </div>
  );
}
