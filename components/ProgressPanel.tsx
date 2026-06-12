"use client";

import { useEffect, useState } from "react";
import { Activity, ImagePlus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/lib/i18n/config";
import type { ProgressUpdate, ProgressComment, ProgressStage } from "@/lib/progress-log";
import { displayAuthor } from "@/lib/identity";

const STR: Record<Locale, {
  title: string;
  empty: string;
  placeholder: string;
  stageLabel: string;
  stages: Record<ProgressStage, string>;
  stageNone: string;
  addPhoto: string;
  post: string;
  posting: string;
  uploadFailed: string;
  postFailed: string;
  comment: string;
  commentPlaceholder: string;
  removeImage: string;
  hoursPlaceholder: string;
  hoursSuffix: string;
  hoursChip: (n: number) => string;
}> = {
  kr: {
    title: "진척",
    empty: "아직 진척 업데이트가 없습니다.",
    placeholder: "이번에 한 일 / 다음 할 일 / 막힌 것",
    stageLabel: "상태",
    stages: { on_track: "순항", delayed: "지연", blocked: "막힘", done: "완료" },
    stageNone: "선택 안 함",
    addPhoto: "사진",
    post: "등록",
    posting: "등록 중…",
    uploadFailed: "사진을 올리지 못했습니다. (5MB 이하 이미지 4장까지)",
    postFailed: "등록하지 못했습니다. 다시 시도해 주세요.",
    comment: "피드백",
    commentPlaceholder: "피드백을 남겨 주세요…",
    removeImage: "사진 제거",
    hoursPlaceholder: "실제 되찾은 시간",
    hoursSuffix: "시간/월",
    hoursChip: (n) => `되찾은 시간 ${n}시간/월`,
  },
  en: {
    title: "Progress",
    empty: "No progress updates yet.",
    placeholder: "Done this time / next up / blocked on",
    stageLabel: "Status",
    stages: { on_track: "On track", delayed: "Delayed", blocked: "Blocked", done: "Done" },
    stageNone: "None",
    addPhoto: "Photo",
    post: "Post",
    posting: "Posting…",
    uploadFailed: "Couldn't upload. (Images up to 5MB, max 4)",
    postFailed: "Couldn't post. Please try again.",
    comment: "Feedback",
    commentPlaceholder: "Leave feedback…",
    removeImage: "Remove photo",
    hoursPlaceholder: "Actual hours returned",
    hoursSuffix: "h/mo",
    hoursChip: (n) => `${n}h/mo returned`,
  },
};

// Visual weight per stage — plain-language labels live in STR (decision D1).
const STAGE_CHIP: Record<ProgressStage, string> = {
  on_track: "border-primary/40 bg-primary/10 text-primary",
  delayed: "border-amber-400/40 bg-amber-400/10 text-amber-500",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
};

const STAGE_KEYS: ProgressStage[] = ["on_track", "delayed", "blocked", "done"];
const MAX_IMAGES = 4;

// Execution-phase feed under a confirmed proposal: the team posts text+photo
// updates, the admin (and the team) replies with feedback. Who may write is
// decided by the server (canPost/canComment in the GET) — re-enforced on POST.
export default function ProgressPanel({ entryId, locale }: { entryId: string; locale: Locale }) {
  const t = STR[locale];

  const [updates, setUpdates] = useState<ProgressUpdate[]>([]);
  const [comments, setComments] = useState<ProgressComment[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [canComment, setCanComment] = useState(false);

  const [text, setText] = useState("");
  const [stage, setStage] = useState<ProgressStage | undefined>(undefined);
  const [hours, setHours] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState("");

  async function load() {
    try {
      const res = await fetch(`/api/evaluations/${entryId}/progress`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        updates?: ProgressUpdate[];
        comments?: ProgressComment[];
        canPost?: boolean;
        canComment?: boolean;
      };
      setUpdates(data.updates ?? []);
      setComments(data.comments ?? []);
      setCanPost(data.canPost === true);
      setCanComment(data.canComment === true);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

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

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const room = MAX_IMAGES - images.length;
      for (const file of [...list].slice(0, room)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = (await res.json().catch(() => null)) as { url?: string } | null;
        if (!res.ok || !data?.url) {
          setError(t.uploadFailed);
          continue;
        }
        setImages((prev) => (prev.length < MAX_IMAGES ? [...prev, data.url!] : prev));
      }
    } catch {
      setError(t.uploadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    if (!text.trim() && images.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/evaluations/${entryId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: text,
          images,
          stage,
          // Measured hours only make sense on a 완료 report.
          hoursReturned: stage === "done" && hours.trim() ? Number(hours) : undefined,
        }),
      });
      if (!res.ok) {
        setError(t.postFailed);
        return;
      }
      setText("");
      setStage(undefined);
      setHours("");
      setImages([]);
      await load();
    } catch {
      setError(t.postFailed);
    } finally {
      setBusy(false);
    }
  }

  async function postComment(updateId: string) {
    const body = (drafts[updateId] ?? "").trim();
    if (!body) return;
    setCommentBusy(updateId);
    try {
      const res = await fetch(`/api/progress/${updateId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        setDrafts((d) => ({ ...d, [updateId]: "" }));
        await load();
      }
    } catch {
      /* ignore */
    } finally {
      setCommentBusy("");
    }
  }

  return (
    <section className="hairline-t pt-5">
      <div className="hairline-b mb-3 flex items-center gap-1.5 pb-2">
        <Activity strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
        <span className="eyebrow">{t.title}</span>
        <span className="text-xs tabular-nums text-muted">({updates.length})</span>
      </div>

      {/* Composer — only for the people running the project */}
      {canPost && (
        <div className="mb-4 rounded-lg border border-border/50 bg-panel2/20 p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={t.placeholder}
            disabled={busy}
            className="w-full resize-y rounded-lg border border-border/70 bg-panel p-2.5 text-sm leading-relaxed text-text outline-none placeholder:text-muted/70 focus:border-primary/50 disabled:opacity-40"
          />

          {images.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {images.map((url) => (
                <li key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-16 w-16 rounded-md border border-border/60 object-cover" />
                  <button
                    type="button"
                    aria-label={t.removeImage}
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-panel p-0.5 text-muted transition hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">{t.stageLabel}:</span>
            {STAGE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setStage(stage === k ? undefined : k)}
                className={`border px-2 py-0.5 text-xs transition ${
                  stage === k ? STAGE_CHIP[k] : "border-border/60 bg-panel2/40 text-muted hover:text-text"
                }`}
              >
                {t.stages[k]}
              </button>
            ))}

            {/* Closing out: report the measured monthly hours actually returned
                (the program's headline metric — aggregated on the admin board). */}
            {stage === "done" && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder={t.hoursPlaceholder}
                  disabled={busy}
                  className="h-6 w-36 rounded-md border border-border/70 bg-panel px-2 text-xs text-text outline-none placeholder:text-muted/70 focus:border-primary/50 disabled:opacity-40"
                />
                {t.hoursSuffix}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text ${busy || images.length >= MAX_IMAGES ? "pointer-events-none opacity-40" : ""}`}>
                <ImagePlus className="h-3.5 w-3.5" />
                {t.addPhoto}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button size="sm" onClick={post} disabled={busy || (!text.trim() && images.length === 0)}>
                <Send className="mr-1 h-3.5 w-3.5" />
                {busy ? t.posting : t.post}
              </Button>
            </div>
          </div>

          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        </div>
      )}

      {/* Timeline — newest first */}
      {updates.length === 0 ? (
        <p className="py-2 text-xs text-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-4">
          {updates.map((u) => {
            const replies = comments.filter((c) => c.updateId === u.id);
            return (
              <li key={u.id} className="rounded-lg border border-border/50 bg-panel/40 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {u.stage && (
                    <span className={`border px-1.5 py-0.5 text-xs uppercase tracking-wide font-medium ${STAGE_CHIP[u.stage]}`}>
                      {t.stages[u.stage]}
                    </span>
                  )}
                  {u.hoursReturned !== undefined && (
                    <span className="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                      {t.hoursChip(u.hoursReturned)}
                    </span>
                  )}
                  <span className="font-medium text-text/80">{displayAuthor(u.author)}</span>
                  <span className="tabular-nums">{fmtTime(u.createdAt)}</span>
                </div>

                {u.body && (
                  <div className="mt-2 text-sm text-text/90">
                    <Markdown text={u.body} />
                  </div>
                )}

                {u.images.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {u.images.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-24 w-24 rounded-md border border-border/60 object-cover transition hover:opacity-80" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {(replies.length > 0 || canComment) && (
                  <div className="hairline-t mt-3 space-y-2 pt-2">
                    {replies.map((c) => (
                      <div key={c.id} className="text-xs">
                        <span className="font-medium text-text/80">{displayAuthor(c.author)}</span>
                        <span className="ml-1.5 tabular-nums text-muted">{fmtTime(c.createdAt)}</span>
                        <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-text/90">{c.body}</p>
                      </div>
                    ))}
                    {canComment && (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={drafts[u.id] ?? ""}
                          onChange={(e) => setDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void postComment(u.id);
                            }
                          }}
                          placeholder={t.commentPlaceholder}
                          disabled={commentBusy === u.id}
                          className="h-7 flex-1 rounded-md border border-border/70 bg-panel px-2 text-xs text-text outline-none placeholder:text-muted/70 focus:border-primary/50 disabled:opacity-40"
                        />
                        <button
                          type="button"
                          onClick={() => void postComment(u.id)}
                          disabled={commentBusy === u.id || !(drafts[u.id] ?? "").trim()}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" />
                          {t.comment}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
