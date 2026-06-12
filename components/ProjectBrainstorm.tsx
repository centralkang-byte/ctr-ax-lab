"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, FileText, Copy, Check, RefreshCw, Pencil, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/lib/i18n/config";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STR: Record<Locale, {
  title: string;
  subtitle: string;
  placeholder: string;
  send: string;
  generate: string;
  generating: string;
  thinking: string;
  brief: string;
  copy: string;
  copied: string;
  regenerate: string;
  refine: string;
  edit: string;
  save: string;
  cancel: string;
  saved: string;
  failed: string;
}> = {
  kr: {
    title: "프로젝트 브레인스토밍",
    subtitle: "대화로 아이디어를 다듬은 뒤, 의사결정자를 위한 한 장짜리 제안서를 만듭니다.",
    placeholder: "답변을 입력하세요…",
    send: "보내기",
    generate: "제안서 생성",
    generating: "제안서 작성 중…",
    thinking: "생각 중…",
    brief: "프로젝트 제안서 (한 장)",
    copy: "복사",
    copied: "복사됨",
    regenerate: "다시 생성",
    refine: "이어서 다듬기",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    saved: "기록에 저장됨",
    failed: "응답에 실패했습니다. 다시 시도해 주세요.",
  },
  en: {
    title: "Project brainstorm",
    subtitle: "Refine the idea through conversation, then generate a one-page proposal for a decision-maker.",
    placeholder: "Type your answer…",
    send: "Send",
    generate: "Generate proposal",
    generating: "Writing proposal…",
    thinking: "Thinking…",
    brief: "Project proposal (one-pager)",
    copy: "Copy",
    copied: "Copied",
    regenerate: "Regenerate",
    refine: "Keep refining",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    saved: "Saved to history",
    failed: "Request failed. Please try again.",
  },
};

// Pull a short title out of the generated proposal (its leading `# ` H1), so the
// saved entry shows something meaningful in History. Falls back to the seed idea.
function extractTitle(proposal: string, fallback: string): string {
  for (const raw of proposal.split("\n")) {
    const line = raw.trim();
    if (/^#\s+/.test(line)) return line.replace(/^#\s+/, "").slice(0, 120);
    if (line) break; // first non-empty line wasn't an H1 — stop looking
  }
  return fallback.slice(0, 120);
}

function withLastAssistant(prev: ChatMsg[], content: string): ChatMsg[] {
  if (!prev.length) return [{ role: "assistant", content }];
  const copy = prev.slice();
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}

export default function ProjectBrainstorm({
  idea,
  locale,
  persist = true,
  entryId,
}: {
  idea: string;
  locale: Locale;
  /** Persist the generated proposal to the shared history when finalized. */
  persist?: boolean;
  /** Existing history entry to patch instead of creating a new one (used when
   *  re-opening an old entry that never got a proposal). */
  entryId?: string;
}) {
  const t = STR[locale];
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const startedRef = useRef(false);
  const savedIdRef = useRef<string | null>(entryId ?? null);
  const lastSavedRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Create on first save, patch on every change after. Best-effort throughout.
  async function saveProposal(proposal: string) {
    if (!persist || !proposal.trim() || proposal === lastSavedRef.current) return;
    const title = extractTitle(proposal, idea);
    try {
      if (savedIdRef.current) {
        const res = await fetch(`/api/evaluations/${savedIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, proposal }),
        });
        if (res.ok) {
          lastSavedRef.current = proposal;
          setSaved(true);
        }
      } else {
        const res = await fetch("/api/evaluations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: idea, title, proposal, locale }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.entry?.id) {
          savedIdRef.current = data.entry.id as string;
          lastSavedRef.current = proposal;
          setSaved(true);
        }
      }
    } catch {
      /* persistence is best-effort */
    }
  }

  async function call(history: ChatMsg[], finalize: boolean) {
    setLoading(true);
    setError(null);
    // Optimistically open the target so streamed chunks have somewhere to land.
    if (finalize) {
      setEditing(false);
      setBrief("");
    } else {
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    }
    try {
      const res = await fetch("/api/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, locale, messages: history, finalize }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t.failed);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (finalize) setBrief(acc);
        else setMessages((prev) => withLastAssistant(prev, acc));
      }
      acc += decoder.decode();
      if (!acc.trim()) throw new Error(t.failed);
      if (finalize) {
        setBrief(acc);
        void saveProposal(acc);
      } else {
        setMessages((prev) => withLastAssistant(prev, acc));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
      // Roll back the empty placeholder so the user can retry cleanly.
      if (finalize) {
        setBrief(null);
      } else {
        setMessages((prev) =>
          prev.length && prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === ""
            ? prev.slice(0, -1)
            : prev
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // Open the conversation once with the coach's first questions.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void call([], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, brief]);

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    void call(next, false);
  }

  async function copyBrief() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function startEdit() {
    if (!brief) return;
    setEditText(brief);
    setEditing(true);
  }

  function saveEdit() {
    const v = editText.trim();
    if (!v) return;
    setBrief(v);
    setEditing(false);
    void saveProposal(v);
  }

  const busyProposal = loading && (brief === "" || brief === null);

  return (
    <div className="mt-5 rounded-xl border border-primary/30 bg-panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles strokeWidth={1.8} className="h-4 w-4 text-primary" />
        <div>
          <div className="text-sm font-semibold text-text">{t.title}</div>
          <div className="text-xs text-muted">{t.subtitle}</div>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="max-h-[26rem] space-y-3 overflow-y-auto rounded-lg border border-border/50 bg-bg/40 p-3"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary/20 text-text"
                  : "border border-border/60 bg-panel2/50 text-text/90"
              }`}
            >
              {m.role === "assistant" && m.content === "" ? (
                <span className="text-muted">{t.thinking}</span>
              ) : (
                <div className="[&_h4]:text-text">
                  <Markdown text={m.content} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}

      {/* Input row + generate action — only while shaping the idea. */}
      {!brief && (
        <>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder={t.placeholder}
              className="min-h-[2.5rem] flex-1 resize-y rounded-lg border border-border/70 bg-panel p-2.5 text-sm text-text outline-none placeholder:text-muted/60 focus:border-primary/50"
            />
            <Button size="icon" onClick={send} disabled={loading || !input.trim()} title={t.send}>
              <Send strokeWidth={1.8} className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => void call(messages, true)}
              disabled={loading || messages.length === 0}
            >
              <FileText strokeWidth={1.8} className="mr-1.5 h-4 w-4" />
              {loading ? t.generating : t.generate}
            </Button>
          </div>
        </>
      )}

      {/* Final proposal — view, edit, regenerate, or jump back to refining. */}
      {brief !== null && (
        <div className="mt-4 rounded-xl border border-border/60 bg-panel2/40 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
              <FileText strokeWidth={1.8} className="h-4 w-4 text-primary" />
              {t.brief}
            </div>
            {!editing && (
              <div className="flex items-center gap-1">
                {saved && !busyProposal && (
                  <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {t.saved}
                  </span>
                )}
                <button
                  onClick={copyBrief}
                  disabled={busyProposal}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t.copied : t.copy}
                </button>
                <button
                  onClick={startEdit}
                  disabled={busyProposal}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t.edit}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={16}
                className="w-full resize-y rounded-lg border border-border/70 bg-panel p-3 font-mono text-xs leading-relaxed text-text outline-none focus:border-primary/50"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X className="mr-1 h-3.5 w-3.5" />
                  {t.cancel}
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={!editText.trim()}>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t.save}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-text/90">
                {brief ? <Markdown text={brief} /> : <span className="text-muted">{t.generating}</span>}
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setBrief(null);
                  }}
                  disabled={busyProposal}
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                  {t.refine}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void call(messages, true)}
                  disabled={loading || messages.length === 0}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  {t.regenerate}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
