"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, History as HistoryIcon, RefreshCw, Lock, Clock } from "lucide-react";
import EvalShell from "@/components/EvalShell";
import ProjectBrainstorm from "@/components/ProjectBrainstorm";
import ProposalDetail from "@/components/ProposalDetail";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { identityFromEmail } from "@/lib/identity";
import { DEFAULT_QUADRANT_THRESHOLD, quadrantLabelForGroups } from "@/lib/scoring";
import type { PublicEvalLogEntry } from "@/lib/eval-log";

const STR = {
  kr: {
    back: "뒤로",
    loading: "불러오는 중…",
    notFound: "프로젝트를 찾을 수 없습니다.",
    seed: "씨앗 아이디어",
    history: "기록",
    historyEmpty: "아직 제안서가 없습니다.",
    proposalBadge: "제안서",
    refresh: "새로고침",
  },
  en: {
    back: "Back",
    loading: "Loading…",
    notFound: "Project not found.",
    seed: "Seed idea",
    history: "History",
    historyEmpty: "No proposals yet.",
    proposalBadge: "Proposal",
    refresh: "Refresh",
  },
} as const;

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale } = useI18n();
  const t = STR[locale];
  const router = useRouter();

  // Return to wherever the user came from — the Admin history tab, the priority
  // map, or the brainstorm list — instead of a fixed page. Fall back to
  // /evaluate only when there's no in-app history to step back to (e.g. the
  // project was opened from a direct link in a fresh tab).
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/evaluate");
  }

  const [entry, setEntry] = useState<PublicEvalLogEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [recent, setRecent] = useState<PublicEvalLogEntry[]>([]);
  const [me, setMe] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  // Admin-configured quadrant boundary — keeps the history-row verdicts in step
  // with this proposal's score panel + the priority map.
  const [quadrantThreshold, setQuadrantThreshold] = useState(DEFAULT_QUADRANT_THRESHOLD);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    (async () => {
      try {
        const [eRes, meRes] = await Promise.all([
          fetch(`/api/evaluations/${id}`, { cache: "no-store" }),
          fetch(`/api/me`, { cache: "no-store" }),
        ]);
        if (active && meRes.ok) {
          const m = (await meRes.json()) as { email?: string | null; isAdmin?: boolean };
          setMe(identityFromEmail(m.email));
          setIsAdmin(m.isAdmin === true);
        }
        if (!eRes.ok) {
          if (active) setStatus("missing");
          return;
        }
        const data = (await eRes.json()) as { entry?: PublicEvalLogEntry };
        if (!active) return;
        if (data.entry) {
          setEntry(data.entry);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      } catch {
        if (active) setStatus("missing");
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Load the shared proposal history for the right-hand list.
  async function loadRecent() {
    try {
      const res = await fetch("/api/evaluations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: PublicEvalLogEntry[] };
      setRecent(data.entries ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadRecent();
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.quadrantThreshold === "number") setQuadrantThreshold(d.quadrantThreshold);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(locale === "kr" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <EvalShell wide>
      <div className="grid grid-cols-1 overflow-hidden border border-border/50 bg-panel/50 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-12 lg:divide-x lg:divide-border/45">
        {/* ── Left: intentionally minimal — just the way back ──────────────── */}
        <div className="flex flex-col p-4 lg:col-span-3 lg:h-full">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
          >
            <ArrowLeft strokeWidth={1.8} className="h-4 w-4" />
            {t.back}
          </button>
        </div>

        {/* ── Middle: the project body (proposal + score + governance) ─────── */}
        <section className="flex min-h-0 flex-col bg-panel/40 p-4 lg:col-span-6 lg:h-full">
          {status === "loading" && <p className="text-sm text-muted">{t.loading}</p>}
          {status === "missing" && <p className="text-sm text-muted">{t.notFound}</p>}

          {status === "ready" && entry && (
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show pr-1">
              {entry.title && (
                <h1 className="mb-3 font-display text-lg font-semibold tracking-tight text-text">{entry.title}</h1>
              )}

              {/* Seed idea — the rough input this record grew from. */}
              <div className="hairline-b mb-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">{t.seed}</span>
                  <span className="text-xs tabular-nums text-muted">{fmtTime(entry.createdAt)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-text/90">{entry.text}</p>
              </div>

              {entry.proposal ? (
                <ProposalDetail initial={entry} locale={locale} me={me} isAdmin={isAdmin} />
              ) : (
                // Legacy rows saved before proposals were persisted — pick the
                // brainstorm back up to produce one.
                <ProjectBrainstorm key={entry.id} idea={entry.text} locale={locale} entryId={entry.id} />
              )}
            </div>
          )}
        </section>

        {/* ── Right: history / list of proposals ───────────────────────────── */}
        <aside className="flex min-h-0 flex-col p-3 lg:col-span-3 lg:h-full">
          <div className="hairline-b mb-2 flex items-center gap-1.5 pb-2">
            <HistoryIcon strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
            <span className="eyebrow">{t.history}</span>
            <span className="text-xs tabular-nums text-muted">({recent.length})</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
            {recent.length === 0 ? (
              <p className="py-3 text-xs text-muted">{t.historyEmpty}</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {recent.map((e) => {
                  const active = e.id === id;
                  const q = quadrantLabelForGroups(e.evaluation?.groupAverages, locale, quadrantThreshold) ?? e.quadrant;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/projects/${e.id}`}
                        className={`group block py-2.5 transition-colors ${
                          active ? "bg-primary/10" : "hover:bg-panel2/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                          <div className="flex items-center gap-1">
                            {e.proposal && (
                              <span className="inline-flex items-center gap-1 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs uppercase tracking-wide text-primary">
                                <FileText strokeWidth={1.8} className="h-2.5 w-2.5" />
                                {t.proposalBadge}
                              </span>
                            )}
                            {e.status === "confirmed" && <Lock strokeWidth={1.8} className="h-3 w-3 text-primary" />}
                            {e.status === "submitted" && <Clock strokeWidth={1.8} className="h-3 w-3 text-muted" />}
                          </div>
                          <span className="tabular-nums">{fmtTime(e.createdAt)}</span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs font-medium text-text decoration-primary/40 underline-offset-2 group-hover:underline">
                          {e.title ?? e.text}
                        </div>
                        {e.overall > 0 && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <span className="tabular-nums text-text/70">{e.overall.toFixed(1)} / 5</span>
                            {q && <span>· {q}</span>}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            href="#"
            onClick={(ev) => {
              ev.preventDefault();
              void loadRecent();
            }}
            className="hairline-t mt-2 inline-flex items-center justify-center gap-1 pt-2 text-xs text-muted transition hover:text-text"
          >
            <RefreshCw strokeWidth={1.8} className="h-3.5 w-3.5" />
            {t.refresh}
          </Link>
        </aside>
      </div>
    </EvalShell>
  );
}
