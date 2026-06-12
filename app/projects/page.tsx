"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Lock, Clock, Activity } from "lucide-react";
import EvalShell from "@/components/EvalShell";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { displayAuthor } from "@/lib/identity";
import { statusLabel } from "@/lib/status-labels";
import type { PublicEvalLogEntry } from "@/lib/eval-log";
import type { ProgressStage } from "@/lib/progress-log";

type OverviewRow = { stage?: ProgressStage; lastUpdateAt: string; updateCount: number };

const STR = {
  kr: {
    title: "과제 현황",
    subtitle: "전사 AX 과제와 진척 상황을 한눈에 봅니다.",
    hoursLabel: "전사 되찾은 시간",
    hoursUnit: "시간/월",
    hoursHint: "완료 보고된 실측치 합계",
    empty: "아직 제출된 과제가 없습니다.",
    loading: "불러오는 중…",
    colProject: "과제",
    colAuthor: "작성자",
    colStatus: "상태",
    colProgress: "진척",
    noProgress: "—",
    stages: { on_track: "순항", delayed: "지연", blocked: "막힘", done: "완료" } as Record<ProgressStage, string>,
    updates: (n: number) => `업데이트 ${n}건`,
  },
  en: {
    title: "Projects",
    subtitle: "All AX projects and their progress at a glance.",
    hoursLabel: "Company hours returned",
    hoursUnit: "h/mo",
    hoursHint: "Sum of reported actuals",
    empty: "No submitted projects yet.",
    loading: "Loading…",
    colProject: "Project",
    colAuthor: "Author",
    colStatus: "Status",
    colProgress: "Progress",
    noProgress: "—",
    stages: { on_track: "On track", delayed: "Delayed", blocked: "Blocked", done: "Done" } as Record<ProgressStage, string>,
    updates: (n: number) => `${n} updates`,
  },
} as const;

const STAGE_CHIP: Record<ProgressStage, string> = {
  on_track: "border-primary/40 bg-primary/10 text-primary",
  delayed: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
};

// Employee-facing browse hub: every submitted/confirmed project (plus the
// viewer's own drafts), each row showing its status and — once approved — its
// latest progress stage. Scores stay redacted by the API for non-author /
// non-coworker viewers; this page never surfaces them. The company-wide
// hours-returned total is the motivating headline. The admin's richer board
// (stale triage, per-project hours) stays in /admin.
export default function ProjectsPage() {
  const { locale } = useI18n();
  const t = STR[locale];

  const [entries, setEntries] = useState<PublicEvalLogEntry[] | null>(null);
  const [overview, setOverview] = useState<Record<string, OverviewRow>>({});
  const [totalHours, setTotalHours] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [eRes, pRes] = await Promise.all([
          fetch("/api/evaluations", { cache: "no-store" }),
          fetch("/api/progress/overview", { cache: "no-store" }),
        ]);
        if (!alive) return;
        if (eRes.ok) {
          const d = (await eRes.json()) as { entries?: PublicEvalLogEntry[] };
          setEntries(d.entries ?? []);
        } else {
          setEntries([]);
        }
        if (pRes.ok) {
          const d = (await pRes.json()) as {
            overview?: Record<string, OverviewRow>;
            totalHoursReturned?: number;
          };
          setOverview(d.overview ?? {});
          setTotalHours(d.totalHoursReturned ?? 0);
        }
      } catch {
        if (alive) setEntries([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(locale === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  };

  return (
    <EvalShell>
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </header>

      {/* Headline: company-wide measured hours returned */}
      <div className="mb-5 flex items-baseline gap-3 rounded-lg border border-border/50 bg-panel2/20 p-4">
        <span className="eyebrow">{t.hoursLabel}</span>
        <span className="font-display text-3xl font-semibold tabular-nums tracking-tight text-text">
          {totalHours.toLocaleString()}
        </span>
        <span className="text-sm text-muted">{t.hoursUnit}</span>
        <span className="ml-auto hidden text-xs text-muted sm:inline">{t.hoursHint}</span>
      </div>

      {entries === null ? (
        <p className="text-sm text-muted">{t.loading}</p>
      ) : entries.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="hairline-b text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">{t.colProject}</th>
              <th className="hidden py-2 pr-3 font-medium sm:table-cell">{t.colAuthor}</th>
              <th className="py-2 pr-3 font-medium">{t.colStatus}</th>
              <th className="py-2 font-medium">{t.colProgress}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {entries.map((e) => {
              const p = overview[e.id];
              return (
                <tr key={e.id} className="align-top">
                  <td className="max-w-md py-2.5 pr-3">
                    <Link
                      href={`/projects/${e.id}`}
                      className="flex items-center gap-1.5 text-text decoration-primary/40 underline-offset-2 hover:underline"
                    >
                      {e.proposal && <FileText strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <span className="line-clamp-2">{e.title ?? e.text}</span>
                    </Link>
                  </td>
                  <td className="hidden py-2.5 pr-3 text-xs text-muted sm:table-cell">
                    {displayAuthor(e.author)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      {e.status === "confirmed" && <Lock strokeWidth={1.8} className="h-3 w-3 text-primary" />}
                      {e.status === "submitted" && <Clock strokeWidth={1.8} className="h-3 w-3" />}
                      {statusLabel(e.status, locale)}
                    </span>
                  </td>
                  <td className="py-2.5">
                    {p?.stage ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STAGE_CHIP[p.stage]}`}>
                          {t.stages[p.stage]}
                        </span>
                        <span className="hidden items-center gap-1 text-xs text-muted md:inline-flex">
                          <Activity strokeWidth={1.8} className="h-3 w-3" />
                          {fmtDate(p.lastUpdateAt)}
                        </span>
                      </span>
                    ) : p?.updateCount ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <Activity strokeWidth={1.8} className="h-3 w-3" />
                        {t.updates(p.updateCount)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{t.noProgress}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </EvalShell>
  );
}
