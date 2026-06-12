"use client";

import { useCallback, useEffect, useState } from "react";
import { History as HistoryIcon, RotateCcw, Eye, GitCompare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/lib/i18n/config";
import type { EvalResult } from "@/lib/evaluator-meta";
import { displayAuthor } from "@/lib/identity";

interface Version {
  id: string;
  version: number;
  title?: string;
  proposal?: string;
  evaluation?: EvalResult;
  author: string;
  createdAt: string;
}

const STR: Record<Locale, {
  title: string;
  empty: string;
  current: string;
  view: string;
  compare: string;
  restore: string;
  restoring: string;
  restored: string;
  added: string;
  removed: string;
  vs: string;
}> = {
  kr: {
    title: "버전 기록",
    empty: "아직 버전이 없습니다.",
    current: "현재",
    view: "보기",
    compare: "현재와 비교",
    restore: "이 버전으로 복원",
    restoring: "복원 중…",
    restored: "복원됨",
    added: "추가",
    removed: "삭제",
    vs: "현재 대비",
  },
  en: {
    title: "Version history",
    empty: "No versions yet.",
    current: "current",
    view: "View",
    compare: "Compare with current",
    restore: "Restore this version",
    restoring: "Restoring…",
    restored: "Restored",
    added: "added",
    removed: "removed",
    vs: "vs current",
  },
};

type DiffRow = { type: "same" | "add" | "del"; text: string };

// LCS line diff — enough to show what a revision changed relative to current.
function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", text: a[i++] });
  while (j < n) out.push({ type: "add", text: b[j++] });
  return out;
}

export default function VersionHistory({
  entryId,
  locale,
  currentProposal,
  canRestore,
  onRestored,
}: {
  entryId: string;
  locale: Locale;
  currentProposal: string;
  /** Show the restore action (hidden once the proposal is confirmed/locked). */
  canRestore: boolean;
  onRestored?: () => void;
}) {
  const t = STR[locale];
  const [versions, setVersions] = useState<Version[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "diff">("view");
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluations/${entryId}/versions`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { versions?: Version[] };
      setVersions(Array.isArray(data.versions) ? data.versions : []);
    } catch {
      /* ignore */
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function restore(version: number) {
    setRestoring(version);
    try {
      const res = await fetch(`/api/evaluations/${entryId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        await load();
        onRestored?.();
      }
    } catch {
      /* ignore */
    } finally {
      setRestoring(null);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-panel p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
          <HistoryIcon strokeWidth={1.8} className="h-4 w-4 text-primary" />
          {t.title}
        </div>
        <p className="text-xs text-muted">{t.empty}</p>
      </div>
    );
  }

  const latest = versions[0]?.version;

  return (
    <div className="rounded-xl border border-border/60 bg-panel p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text">
        <HistoryIcon strokeWidth={1.8} className="h-4 w-4 text-primary" />
        {t.title}
        <span className="text-xs font-normal text-muted">({versions.length})</span>
      </div>

      <ul className="space-y-2">
        {versions.map((v) => {
          const isOpen = openId === v.id;
          return (
            <li key={v.id} className="rounded-lg border border-border/60 bg-panel2/40">
              <div className="flex items-center justify-between gap-2 p-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-primary/10 px-2 py-0.5 font-medium tabular-nums text-primary">
                    v{v.version}
                  </span>
                  {v.version === latest && <span className="text-xs text-muted">{t.current}</span>}
                  <span className="text-muted">{fmtTime(v.createdAt)}</span>
                  {v.author && <span className="text-muted/70">· {displayAuthor(v.author)}</span>}
                  {typeof v.evaluation?.overall === "number" && (
                    <span className="tabular-nums text-text/70">{v.evaluation.overall.toFixed(1)}/5</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setOpenId(isOpen && mode === "view" ? null : v.id);
                      setMode("view");
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t.view}
                  </button>
                  {v.version !== latest && (
                    <button
                      onClick={() => {
                        setOpenId(isOpen && mode === "diff" ? null : v.id);
                        setMode("diff");
                      }}
                      title={t.compare}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canRestore && v.version !== latest && (
                    <button
                      onClick={() => void restore(v.version)}
                      disabled={restoring !== null}
                      title={t.restore}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
                    >
                      {restoring === v.version ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border/40 p-3">
                  {mode === "view" ? (
                    <div className="text-xs text-text/85">
                      <Markdown text={v.proposal ?? ""} />
                    </div>
                  ) : (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-snug">
                      {diffLines(v.proposal ?? "", currentProposal).map((row, i) => (
                        <div
                          key={i}
                          className={
                            row.type === "add"
                              ? "bg-primary/10 text-primary"
                              : row.type === "del"
                                ? "bg-destructive/10 text-destructive line-through"
                                : "text-text/60"
                          }
                        >
                          {row.type === "add" ? "+ " : row.type === "del" ? "- " : "  "}
                          {row.text || " "}
                        </div>
                      ))}
                    </pre>
                  )}
                  {mode === "diff" && (
                    <p className="mt-2 text-xs text-muted">{t.vs}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
