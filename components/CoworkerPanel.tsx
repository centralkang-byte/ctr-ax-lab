"use client";

import { useState } from "react";
import { Users, X, Plus } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { coworkerKeyFromInput, displayAuthor, PRIMARY_DOMAIN } from "@/lib/identity";

const STR: Record<Locale, {
  title: string;
  desc: string;
  placeholder: string;
  add: string;
  invalid: string;
  saveFailed: string;
  remove: string;
}> = {
  kr: {
    title: "함께 보기",
    desc: "등록된 리더·동료는 이 과제의 점수를 함께 볼 수 있습니다.",
    placeholder: PRIMARY_DOMAIN ? `이메일 또는 아이디 (@${PRIMARY_DOMAIN})` : "회사 이메일",
    add: "추가",
    invalid: "회사 이메일(또는 아이디)이 아닙니다.",
    saveFailed: "저장하지 못했습니다. 다시 시도해 주세요.",
    remove: "삭제",
  },
  en: {
    title: "Shared with",
    desc: "Registered leaders/teammates can see this project's score.",
    placeholder: PRIMARY_DOMAIN ? `Email or id (@${PRIMARY_DOMAIN})` : "Company email",
    add: "Add",
    invalid: "Not a company email (or id).",
    saveFailed: "Couldn't save. Please try again.",
    remove: "Remove",
  },
};

// Co-worker list on a proposal: the author registers a leader (팀장/본부장) or a
// teammate so they can follow the project (score visibility now, progress later).
// Read-only chips for everyone else. Server enforces author-only writes — this
// just keeps the affordance away from non-owners.
export default function CoworkerPanel({
  entryId,
  locale,
  coworkers,
  canManage,
  onChanged,
}: {
  entryId: string;
  locale: Locale;
  coworkers: string[];
  canManage: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const t = STR[locale];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Nothing to show: no chips and no right to add any.
  if (!canManage && coworkers.length === 0) return null;

  async function save(next: string[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/evaluations/${entryId}/coworkers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coworkers: next }),
      });
      if (!res.ok) {
        setError(t.saveFailed);
        return;
      }
      setInput("");
      await onChanged();
    } catch {
      setError(t.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  function add() {
    // Same normalization the server applies — catches typos before the round trip.
    const key = coworkerKeyFromInput(input);
    if (!key) {
      setError(t.invalid);
      return;
    }
    if (coworkers.includes(key)) {
      setInput("");
      return;
    }
    void save([...coworkers, key]);
  }

  return (
    <section className="rounded-lg border border-border/50 bg-panel2/20 p-3">
      <div className="flex items-center gap-1.5">
        <Users strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
        <span className="eyebrow">{t.title}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{t.desc}</p>

      {coworkers.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {coworkers.map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1 border border-border/60 bg-panel/60 px-2 py-0.5 text-xs text-text/90"
            >
              {displayAuthor(c)}
              {canManage && (
                <button
                  type="button"
                  aria-label={`${t.remove}: ${displayAuthor(c)}`}
                  disabled={busy}
                  onClick={() => void save(coworkers.filter((x) => x !== c))}
                  className="text-muted transition hover:text-destructive disabled:opacity-40"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={t.placeholder}
            disabled={busy}
            className="h-7 w-56 max-w-full rounded-md border border-border/70 bg-panel px-2 text-xs text-text outline-none placeholder:text-muted/70 focus:border-primary/50 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !input.trim()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.add}
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </section>
  );
}
