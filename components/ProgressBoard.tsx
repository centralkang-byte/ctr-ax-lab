"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock3 } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { ProgressStage } from "@/lib/progress-log";
import { displayAuthor } from "@/lib/identity";

type BoardProject = {
  id: string;
  title: string;
  submitter: string;
  coworkers: string[];
  confirmedAt?: string;
  updateCount: number;
  lastUpdateAt?: string;
  lastStage?: ProgressStage;
  hoursReturned?: number;
  stale: boolean;
};

const STR: Record<Locale, {
  loading: string;
  empty: string;
  totalLabel: string;
  totalUnit: string;
  totalHint: string;
  staleBadge: (d: number) => string;
  colProject: string;
  colTeam: string;
  colUpdates: string;
  colLast: string;
  colHours: string;
  noUpdates: string;
  stages: Record<ProgressStage, string>;
}> = {
  kr: {
    loading: "불러오는 중…",
    empty: "승인된 과제가 아직 없습니다.",
    totalLabel: "전사 되찾은 시간",
    totalUnit: "시간/월",
    totalHint: "완료 보고된 실측치 합계",
    staleBadge: (d) => `${d}일+ 정체`,
    colProject: "과제",
    colTeam: "담당",
    colUpdates: "업데이트",
    colLast: "마지막 활동",
    colHours: "되찾은 시간",
    noUpdates: "업데이트 없음",
    stages: { on_track: "순항", delayed: "지연", blocked: "막힘", done: "완료" },
  },
  en: {
    loading: "Loading…",
    empty: "No confirmed projects yet.",
    totalLabel: "Company hours returned",
    totalUnit: "h/mo",
    totalHint: "Sum of reported actuals",
    staleBadge: (d) => `stale ${d}d+`,
    colProject: "Project",
    colTeam: "Team",
    colUpdates: "Updates",
    colLast: "Last activity",
    colHours: "Hours returned",
    noUpdates: "no updates",
    stages: { on_track: "On track", delayed: "Delayed", blocked: "Blocked", done: "Done" },
  },
};

const STAGE_CHIP: Record<ProgressStage, string> = {
  on_track: "border-primary/40 bg-primary/10 text-primary",
  delayed: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
};

// Admin execution board: every confirmed project, who runs it, how alive it is
// (stale flag from the server), and the measured hours returned — the program's
// headline number. Stale projects sort to the top: that's where the admin looks.
export default function ProgressBoard({ locale }: { locale: Locale }) {
  const t = STR[locale];
  const [projects, setProjects] = useState<BoardProject[] | null>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [staleDays, setStaleDays] = useState(14);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/progress", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          projects?: BoardProject[];
          totalHoursReturned?: number;
          staleAfterDays?: number;
        };
        if (!alive) return;
        const list = data.projects ?? [];
        // Stale first, then least-recently-active first — triage order.
        list.sort((a, b) => {
          if (a.stale !== b.stale) return a.stale ? -1 : 1;
          return (a.lastUpdateAt ?? a.confirmedAt ?? "").localeCompare(b.lastUpdateAt ?? b.confirmedAt ?? "");
        });
        setProjects(list);
        setTotalHours(data.totalHoursReturned ?? 0);
        if (typeof data.staleAfterDays === "number") setStaleDays(data.staleAfterDays);
      } catch {
        if (alive) setProjects([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fmtDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(locale === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
  };

  if (projects === null) return <p className="text-sm text-muted">{t.loading}</p>;

  return (
    <div className="space-y-4">
      {/* Headline: measured hours returned across the company */}
      <div className="flex items-baseline gap-3 rounded-lg border border-border/50 bg-panel2/20 p-4">
        <span className="eyebrow">{t.totalLabel}</span>
        <span className="font-display text-3xl font-semibold tabular-nums tracking-tight text-text">
          {totalHours.toLocaleString()}
        </span>
        <span className="text-sm text-muted">{t.totalUnit}</span>
        <span className="ml-auto text-xs text-muted">{t.totalHint}</span>
      </div>

      {projects.length === 0 ? (
        <p className="py-2 text-sm text-muted">{t.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="hairline-b text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-medium">{t.colProject}</th>
              <th className="py-2 pr-3 font-medium">{t.colTeam}</th>
              <th className="py-2 pr-3 font-medium tabular-nums">{t.colUpdates}</th>
              <th className="py-2 pr-3 font-medium">{t.colLast}</th>
              <th className="py-2 font-medium">{t.colHours}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {projects.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="max-w-md py-2.5 pr-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.stale && (
                      <span className="inline-flex items-center gap-1 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {t.staleBadge(staleDays)}
                      </span>
                    )}
                    {p.lastStage && (
                      <span className={`border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide ${STAGE_CHIP[p.lastStage]}`}>
                        {t.stages[p.lastStage]}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="mt-1 block text-text decoration-primary/40 underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                </td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  {displayAuthor(p.submitter)}
                  {p.coworkers.length > 0 && ` +${p.coworkers.length}`}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-muted">{p.updateCount}</td>
                <td className="py-2.5 pr-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock3 className="h-3 w-3" />
                    {p.updateCount === 0 ? t.noUpdates : fmtDate(p.lastUpdateAt)}
                  </span>
                </td>
                <td className="py-2.5 tabular-nums text-text/90">
                  {p.hoursReturned ? `${p.hoursReturned}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
