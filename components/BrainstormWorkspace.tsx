"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Send,
  Sparkles,
  FileText,
  Copy,
  Check,
  Pencil,
  X,
  RefreshCw,
  Download,
  Printer,
  Lock,
  Clock,
  Search,
  LayoutGrid,
  MessageSquare,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/Markdown";
import SuggestionCards from "@/components/SuggestionCards";
import { EXAMPLES_POOL, CATEGORY_META } from "@/lib/examples";
import ProposalDetail from "@/components/ProposalDetail";
import { fadeRiseFor, staggerContainer } from "@/lib/motion";
import {
  quadrantKey,
  quadrantLabel,
  quadrantLabelForGroups,
  DEFAULT_QUADRANT_THRESHOLD,
  type QuadrantKey,
} from "@/lib/scoring";
import { statusLabel } from "@/lib/status-labels";
import type { Locale } from "@/lib/i18n/config";
import type { PublicEvalLogEntry } from "@/lib/eval-log";
import type { EvalResult } from "@/lib/evaluator-meta";
import { DEFAULT_SUBMIT_THRESHOLD } from "@/lib/scoring";
import { identityFromEmail, sameUser, displayAuthor } from "@/lib/identity";

type ChatMsg = { role: "user" | "assistant"; content: string };

const STR: Record<Locale, {
  title: string;
  subtitle: string;
  seedLabel: string;
  placeholder: string;
  start: string;
  short: string;
  newIdea: string;
  chatPlaceholder: string;
  send: string;
  thinking: string;
  generate: string;
  regenerate: string;
  generating: string;
  onePager: string;
  emptyProposal: string;
  copy: string;
  copied: string;
  edit: string;
  save: string;
  cancel: string;
  exportMd: string;
  exportPdf: string;
  saved: string;
  history: string;
  historyEmpty: string;
  open: string;
  proposalBadge: string;
  failed: string;
  seedHeading: string;
  scoring: string;
  scoreError: string;
  submit: string;
  submitting: string;
  submitGate: (n: number) => string;
  surprise: string;
  scoreLabel: string;
  sortDate: string;
  sortScore: string;
  sortPerson: string;
  myProposals: string;
  teamHistory: string;
  restartConfirm: string;
  saveFailed: string;
  retry: string;
  notSavedYet: string;
  submitLocked: string;
  submitForbidden: string;
  rescore: string;
  allExamples: string;
  exampleSearch: string;
  exampleEmpty: string;
  answerGate: (n: number) => string;
  pickAnswer: string;
  pickHint: string;
  orTypeOwn: string;
}> = {
  kr: {
    title: "프로젝트 브레인스토밍",
    subtitle: "코치와 대화하며 아이디어를 다듬고, 의사결정자를 위한 한 장짜리 제안서로 정리하세요.",
    seedLabel: "어떤 문제나 아이디어가 떠오르세요?",
    placeholder:
      "예: 직원들이 인사 정책을 물어볼 때마다 인사팀에 메시지를 보내는 게 번거롭다. 정책 PDF에서 답을 찾아주는 도구가 있으면 좋겠다.",
    start: "브레인스토밍 시작",
    surprise: "랜덤으로 시작",
    short: "한 문장 이상 입력해 주세요.",
    newIdea: "새 아이디어",
    chatPlaceholder: "답변을 입력하세요…",
    send: "보내기",
    thinking: "생각 중…",
    generate: "제안서 생성",
    regenerate: "다시 생성",
    generating: "제안서 작성 중…",
    onePager: "한 장짜리 제안서",
    emptyProposal: "왼쪽에서 대화를 나눈 뒤 ‘제안서 생성’을 누르면 여기에 제안서가 나타납니다.",
    copy: "복사",
    copied: "복사됨",
    edit: "편집",
    save: "저장",
    cancel: "취소",
    exportMd: "Markdown",
    exportPdf: "PDF",
    saved: "기록에 저장됨",
    history: "기록",
    historyEmpty: "아직 제안서가 없습니다.",
    open: "열기",
    proposalBadge: "제안서",
    failed: "응답에 실패했습니다. 다시 시도해 주세요.",
    seedHeading: "씨앗 아이디어",
    scoring: "채점 중…",
    scoreError: "채점에 실패했습니다.",
    submit: "제출",
    submitting: "제출 중…",
    submitGate: (n: number) => `제출하려면 종합 ${n}점 이상이 필요합니다. 왼쪽에서 더 다듬어 보세요.`,
    scoreLabel: "채점 결과",
    sortDate: "날짜",
    sortScore: "점수",
    sortPerson: "작성자",
    myProposals: "내 제안서",
    teamHistory: "팀 기록",
    restartConfirm: "진행 중인 대화를 지우고 새로 시작할까요? 지금까지의 대화는 복구할 수 없습니다.",
    saveFailed: "저장 실패 — 제안서가 아직 기록에 저장되지 않았습니다.",
    retry: "다시 시도",
    notSavedYet: "제안서가 아직 저장되지 않았습니다. 저장에 성공해야 제출할 수 있습니다.",
    submitLocked: "이미 승인된 제안서라 변경할 수 없습니다.",
    submitForbidden: "본인의 제안서만 제출할 수 있습니다.",
    rescore: "다시 채점",
    allExamples: "전체 예시",
    exampleSearch: "아이디어 검색…",
    exampleEmpty: "검색 결과가 없습니다.",
    answerGate: (n: number) => `제안서를 만들려면 질문 ${n}개에 답해 주세요`,
    pickAnswer: "답변 선택",
    pickHint: "여러 개 선택 가능",
    orTypeOwn: "직접 입력 추가…",
  },
  en: {
    title: "Project brainstorm",
    subtitle:
      "Talk it through with a coach, then shape it into a one-page proposal for a decision-maker.",
    seedLabel: "What problem or idea is on your mind?",
    placeholder:
      "e.g. Employees keep pinging the People team to ask about HR policy. I wish there were a tool that answered from our policy PDFs.",
    start: "Start brainstorming",
    surprise: "Surprise me",
    short: "Please enter at least a sentence.",
    newIdea: "New idea",
    chatPlaceholder: "Type your answer…",
    send: "Send",
    thinking: "Thinking…",
    generate: "Generate proposal",
    regenerate: "Regenerate",
    generating: "Writing proposal…",
    onePager: "One-page proposal",
    emptyProposal: "Brainstorm on the left, then hit ‘Generate proposal’ and it will appear here.",
    copy: "Copy",
    copied: "Copied",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    exportMd: "Markdown",
    exportPdf: "PDF",
    saved: "Saved to history",
    history: "History",
    historyEmpty: "No proposals yet.",
    open: "Open",
    proposalBadge: "Proposal",
    failed: "Request failed. Please try again.",
    seedHeading: "Seed idea",
    scoring: "Scoring…",
    scoreError: "Scoring failed.",
    submit: "Submit",
    submitting: "Submitting…",
    submitGate: (n: number) => `Needs an overall score of ${n}+ to submit. Keep refining on the left.`,
    scoreLabel: "Score",
    sortDate: "Date",
    sortScore: "Score",
    sortPerson: "Person",
    myProposals: "My proposals",
    teamHistory: "Team history",
    restartConfirm: "Discard the current conversation and start over? It cannot be recovered.",
    saveFailed: "Save failed — the proposal isn't in history yet.",
    retry: "Retry",
    notSavedYet: "The proposal hasn't been saved yet. The save must succeed before submitting.",
    submitLocked: "Already approved — it can no longer be changed.",
    submitForbidden: "Only the author can submit this proposal.",
    rescore: "Re-score",
    allExamples: "All examples",
    exampleSearch: "Search ideas…",
    exampleEmpty: "No matching ideas.",
    answerGate: (n: number) => `Answer ${n} questions to generate a proposal`,
    pickAnswer: "Pick answers",
    pickHint: "choose one or more",
    orTypeOwn: "Add your own…",
  },
};

type SortKey = "date" | "score" | "person";

// How many of the coach's questions a user must answer before the proposal can
// be generated — keeps the brainstorm a real multi-turn discovery, not one-shot.
const MIN_ANSWERS = 5;

// The live brainstorm session, backed up to sessionStorage on every change so a
// reload restores the interview instead of destroying it — the conversation is
// the user's real invested effort (MIN_ANSWERS+ answers) and exists nowhere
// else until the proposal is finalized. sessionStorage, not localStorage:
// scoped to the tab, so nothing lingers on shared machines.
const BACKUP_KEY = "ax-brainstorm-session-v1";
type SessionBackup = {
  seed: string;
  messages: ChatMsg[];
  brief: string | null;
  score: EvalResult | null;
  status: "draft" | "submitted" | "confirmed";
  savedId: string | null;
  lastSaved: string;
  saved: boolean;
};

// Pull a short title out of the generated proposal (its leading `# ` H1).
function extractTitle(proposal: string, fallback: string): string {
  for (const raw of proposal.split("\n")) {
    const line = raw.trim();
    if (/^#\s+/.test(line)) return line.replace(/^#\s+/, "").slice(0, 120);
    if (line) break;
  }
  return fallback.slice(0, 120);
}

// The coach appends suggested answers to a question as a final line
//   @@OPTIONS: choice 1 || choice 2 || choice 3
// Split the visible question text from those options so the UI can render the
// options as pickable chips (à la AskUserQuestion) while hiding the raw marker.
const OPT_MARK = "@@OPTIONS:";
function parseOptions(content: string): { text: string; options: string[] } {
  const i = content.indexOf(OPT_MARK);
  if (i === -1) return { text: content, options: [] };
  const text = content.slice(0, i).trimEnd();
  const raw = content.slice(i + OPT_MARK.length).trim();
  const parts = raw.includes("||") ? raw.split("||") : raw.split("\n");
  const options = parts
    // Strip a leading list marker (bullet, or "1." / "1)") but NOT bare digits
    // that belong to the option text itself, e.g. "10장 이상".
    .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
  return { text, options };
}

function withLastAssistant(prev: ChatMsg[], content: string): ChatMsg[] {
  if (!prev.length) return [{ role: "assistant", content }];
  const copy = prev.slice();
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}

// Localized quadrant for a history row. The stored `quadrant` is always the bare
// English label ("Quick Win"), so derive it from the entry's own group averages
// and run it through quadrantLabel — matching what the score panel shows in the
// same locale. Falls back to the raw stored string for legacy rows that predate
// the stored evaluation.
function entryQuadrantLabel(
  e: PublicEvalLogEntry,
  locale: Locale,
  threshold: number
): string | null {
  return quadrantLabelForGroups(e.evaluation?.groupAverages, locale, threshold) ?? e.quadrant ?? null;
}

// ── Export helpers (no dependencies) ─────────────────────────────────────────

function slugify(s: string): string {
  const base = (s || "proposal")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "proposal";
}

function downloadMarkdown(title: string, md: string) {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mdInline(s: string): string {
  let out = escHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, txt, url) => `<a href="${url}">${txt}</a>`);
  return out;
}

function mdToHtml(text: string): string {
  const html: string[] = [];
  let items: string[] = [];
  let ordered = false;
  const flush = () => {
    if (!items.length) return;
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>${items.map((it) => `<li>${it}</li>`).join("")}</${tag}>`);
    items = [];
  };
  const push = (c: string, ord: boolean) => {
    if (items.length && ordered !== ord) flush();
    ordered = ord;
    items.push(mdInline(c));
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^#\s+/.test(line)) {
      flush();
      html.push(`<h1>${mdInline(line.replace(/^#\s+/, ""))}</h1>`);
    } else if (/^#{2,3}\s+/.test(line)) {
      flush();
      html.push(`<h2>${mdInline(line.replace(/^#{2,3}\s+/, ""))}</h2>`);
    } else if (/^\d+\.\s+/.test(line)) {
      push(line.replace(/^\d+\.\s+/, ""), true);
    } else if (/^[-*]\s+/.test(line)) {
      push(line.replace(/^[-*]\s+/, ""), false);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      html.push(`<p>${mdInline(line)}</p>`);
    }
  }
  flush();
  return html.join("\n");
}

function printPdf(title: string, md: string) {
  const w = window.open("", "_blank", "width=860,height=1100");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;color:#111;line-height:1.6;max-width:720px;margin:48px auto;padding:0 28px}
h1{font-size:24px;margin:0 0 16px;letter-spacing:-.01em}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#555;margin:22px 0 6px;border-bottom:1px solid #e6e6e6;padding-bottom:4px}
p{margin:6px 0}ul,ol{margin:6px 0;padding-left:22px}li{margin:3px 0}
a{color:#1a56db;text-decoration:underline}strong{font-weight:600}
@media print{body{margin:0 auto}}
</style></head><body>${mdToHtml(md)}<script>window.onload=function(){setTimeout(function(){window.print();},80);};<\/script></body></html>`
  );
  w.document.close();
}

// ── Star-chart vocabulary ────────────────────────────────────────────────────

const GOLD = "rgb(var(--c-accent-3))";

// The hero: the proposal plotted as a star on a 2D Impact × Feasibility chart.
function StarMap({
  score,
  locale,
  reduce,
  threshold,
  quadrantThreshold,
}: {
  score: EvalResult;
  locale: Locale;
  reduce: boolean;
  threshold: number;
  quadrantThreshold: number;
}) {
  const impact = score.groupAverages.find((g) => g.key === "impact")?.average ?? 0;
  const feas = score.groupAverages.find((g) => g.key === "feasibility")?.average ?? 0;
  const qk = quadrantKey(impact, feas, quadrantThreshold);
  const x = Math.max(3, Math.min(97, ((feas - 1) / 4) * 100)); // feasibility → x
  const y = Math.max(3, Math.min(97, ((impact - 1) / 4) * 100)); // impact → y (from bottom)
  const TH = ((quadrantThreshold - 1) / 4) * 100; // the "high" line at the configured boundary

  const activeRect: Record<QuadrantKey, CSSProperties> = {
    "quick-win": { left: `${TH}%`, right: 0, top: 0, height: `${100 - TH}%` },
    "big-bet": { left: 0, width: `${TH}%`, top: 0, height: `${100 - TH}%` },
    "fill-in": { left: `${TH}%`, right: 0, bottom: 0, height: `${TH}%` },
    "money-pit": { left: 0, width: `${TH}%`, bottom: 0, height: `${TH}%` },
  };
  const corners: { k: QuadrantKey; pos: string }[] = [
    { k: "big-bet", pos: "left-1.5 top-1.5 text-left" },
    { k: "quick-win", pos: "right-1.5 top-1.5 text-right" },
    { k: "money-pit", pos: "bottom-4 left-1.5 text-left" },
    { k: "fill-in", pos: "bottom-4 right-1.5 text-right" },
  ];
  const isLow = score.overall < threshold;

  return (
    <div className="hairline-t pt-4">
      {/* Magnitude + quadrant verdict */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-2">
          <span className="magnitude text-5xl font-semibold text-text">{score.overall.toFixed(1)}</span>
          <span className="eyebrow mb-1.5">/ 5</span>
        </div>
        <span
          className="border px-2 py-0.5 text-xs uppercase tracking-wide"
          style={{ color: GOLD, borderColor: "rgb(var(--c-accent-3) / 0.5)", background: "rgb(var(--c-accent-3) / 0.1)" }}
        >
          {quadrantLabel(qk, locale)}
        </span>
      </div>

      {/* The chart */}
      <div className="relative mt-3 aspect-[5/4] w-full overflow-hidden border border-border/50 bg-bg/30">
        {/* active quadrant tint */}
        <div className="pointer-events-none absolute" style={{ ...activeRect[qk], background: "rgb(var(--c-accent-3) / 0.08)" }} />
        {/* integer gridlines */}
        <div className="chart-grid absolute inset-0 opacity-70" />
        {/* "high" threshold crosshair (3.5) */}
        <div className="absolute inset-y-0 border-l border-dashed" style={{ left: `${TH}%`, borderColor: "rgb(var(--c-accent-3) / 0.4)" }} />
        <div className="absolute inset-x-0 border-t border-dashed" style={{ top: `${100 - TH}%`, borderColor: "rgb(var(--c-accent-3) / 0.4)" }} />
        {/* quadrant corner labels */}
        {corners.map((c) => (
          <span
            key={c.k}
            className={`pointer-events-none absolute text-xs uppercase tracking-wider ${c.pos}`}
            style={c.k === qk ? { color: GOLD } : { color: "rgb(var(--c-muted) / 0.6)" }}
          >
            {quadrantLabel(c.k, locale)}
          </span>
        ))}
        {/* axes */}
        <span className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.22em] text-muted/70">
          {locale === "kr" ? "실현가능성 →" : "feasibility →"}
        </span>
        <span className="pointer-events-none absolute left-0.5 top-1/2 -translate-y-1/2 -rotate-90 text-xs uppercase tracking-[0.22em] text-muted/70">
          {locale === "kr" ? "임팩트 →" : "impact →"}
        </span>
        {/* the plotted proposal */}
        <motion.div
          className="absolute"
          style={{ left: `${x}%`, bottom: `${y}%` }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
        >
          <span className={`block -translate-x-1/2 translate-y-1/2 ${reduce ? "" : "nstar-twinkle"}`}>
            <span className="block h-3 w-3 rounded-full bg-primary" />
          </span>
        </motion.div>
      </div>

      {/* Coordinate readouts */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {score.groupAverages.map((g) => (
          <div key={g.key} className="border border-border/40 bg-panel/30 px-3 py-2">
            <div className="eyebrow">{g.label}</div>
            <div className="coord mt-0.5 text-text/90">
              <span className="text-base font-semibold">{g.average.toFixed(1)}</span>
              <span className="text-xs text-muted"> / 5</span>
            </div>
          </div>
        ))}
      </div>

      {/* Verdict summary */}
      {score.summary && <p className="mt-3 text-sm leading-relaxed text-text/80">{score.summary}</p>}

      {/* How to brighten it — shown when below the submit bar */}
      {isLow && score.suggestions.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-3">
          <div className="eyebrow mb-1.5">{locale === "kr" ? "보완하면 좋은 점" : "How to improve"}</div>
          <ul className="space-y-1">
            {score.suggestions.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-text/80">
                <span style={{ color: GOLD }}>✦</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Slim instrument masthead spanning the frame: identity + a live status readout.
function Masthead({
  locale,
  phase,
  magnitude,
}: {
  locale: Locale;
  phase: "idle" | "drafting" | "plotting" | "charted";
  magnitude: number | null;
}) {
  const label = {
    idle: locale === "kr" ? "대기" : "Standby",
    drafting: locale === "kr" ? "작성 중" : "Drafting",
    plotting: locale === "kr" ? "좌표 계산 중" : "Plotting",
    charted: locale === "kr" ? "기록됨" : "Charted",
  }[phase];
  const live = phase === "plotting" || phase === "drafting";
  return (
    <div className="hairline-b flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="eyebrow">{locale === "kr" ? "임팩트 × 실현가능성" : "Impact × Feasibility"}</span>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em]">
        {magnitude != null && (
          <span className="coord text-text/80">
            {locale === "kr" ? "종합" : "Score"} {magnitude.toFixed(1)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span
            className={`h-1.5 w-1.5 rounded-full ${live && "nstar-twinkle"}`}
            style={{ background: live ? GOLD : "rgb(var(--c-muted))" }}
          />
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Workspace ────────────────────────────────────────────────────────────────

export default function BrainstormWorkspace({ locale }: { locale: Locale }) {
  const t = STR[locale];
  const reduce = useReducedMotion() ?? false;

  // Admin-configured submit gate (server enforces; this keeps the button in sync).
  const [threshold, setThreshold] = useState(DEFAULT_SUBMIT_THRESHOLD);
  // Admin-configured quadrant boundary — keeps the quadrant labels on this page
  // (history rows + the star-map) in step with the priority map.
  const [quadrantThreshold, setQuadrantThreshold] = useState(DEFAULT_QUADRANT_THRESHOLD);
  useEffect(() => {
    let alive = true;
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        if (typeof d.submitThreshold === "number") setThreshold(d.submitThreshold);
        if (typeof d.quadrantThreshold === "number") setQuadrantThreshold(d.quadrantThreshold);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Seed-entry state
  const [text, setText] = useState("");
  const [seed, setSeed] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // Brainstorm state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  // Options the user has toggled for the current question (multi-select).
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Scoring + submission state
  const [score, setScore] = useState<EvalResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState(false);
  const [status, setStatus] = useState<"draft" | "submitted" | "confirmed">("draft");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // History (right panel)
  const [recent, setRecent] = useState<PublicEvalLogEntry[]>([]);
  // The history entry opened in the popup (null = closed). The dialog renders
  // the full ProposalDetail (score, edit, versions, submit, admin confirm).
  const [active, setActive] = useState<PublicEvalLogEntry | null>(null);
  const [me, setMe] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // "All examples" picker (browse the full seed-idea pool, search + select).
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [exampleQuery, setExampleQuery] = useState("");
  const [exampleCat, setExampleCat] = useState<string>("all");

  const savedIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef<string>("");
  const startedSeedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the transcript should stay pinned to its newest turn — cleared when
  // the user deliberately scrolls up to re-read, restored at the bottom.
  const stickRef = useRef(true);

  // Restore a backed-up session once on mount (see SessionBackup above). The
  // ref assignments must precede setSeed so the seed effect below treats the
  // conversation as already opened instead of resetting it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BACKUP_KEY);
      if (!raw) return;
      const b = JSON.parse(raw) as SessionBackup;
      if (!b?.seed || !Array.isArray(b.messages)) return;
      // A reload mid-stream would have persisted a half-formed turn: an empty
      // trailing assistant bubble (the coach was still typing) renders as a
      // permanently-stuck "생각 중…" since `loading` is false after reload.
      // Drop that, and the now-dangling unanswered user turn with it, so we
      // restore to the last complete coach question.
      const msgs = b.messages.filter(
        (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
      );
      while (msgs.length && msgs[msgs.length - 1].role === "assistant" && !msgs[msgs.length - 1].content.trim()) {
        msgs.pop();
        if (msgs.length && msgs[msgs.length - 1].role === "user") msgs.pop();
      }
      // A half-streamed proposal ("" while drafting) is not worth restoring.
      const safeBrief = typeof b.brief === "string" && b.brief.trim() ? b.brief : null;
      startedSeedRef.current = b.seed;
      savedIdRef.current = b.savedId ?? null;
      lastSavedRef.current = b.lastSaved ?? "";
      setSeed(b.seed);
      setMessages(msgs);
      setBrief(safeBrief);
      setScore(safeBrief ? (b.score ?? null) : null);
      setStatus(b.status === "submitted" || b.status === "confirmed" ? b.status : "draft");
      setSaved(b.saved === true && !!safeBrief);
    } catch {
      /* corrupted backup — start fresh */
    }
  }, []);

  // Declared after the restore effect on purpose: on the first mount this sees
  // seed === null and clears the key, but the restore above has already read it.
  useEffect(() => {
    try {
      if (!seed) {
        sessionStorage.removeItem(BACKUP_KEY);
        return;
      }
      const b: SessionBackup = {
        seed,
        messages,
        brief,
        score,
        status,
        savedId: savedIdRef.current,
        lastSaved: lastSavedRef.current,
        saved,
      };
      sessionStorage.setItem(BACKUP_KEY, JSON.stringify(b));
    } catch {
      /* quota / private mode — the backup is best-effort */
    }
  }, [seed, messages, brief, score, status, saved]);

  // Warn before leaving while an interview is live and unsubmitted — closing
  // the tab is the one path sessionStorage doesn't survive.
  useEffect(() => {
    if (!seed || messages.length === 0 || status !== "draft") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // some browsers still gate the prompt on this
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [seed, messages.length, status]);

  const sortedRecent = useMemo(() => {
    const arr = [...recent];
    if (sortBy === "score") {
      arr.sort((a, b) =>
        sortDir === "desc"
          ? (b.overall ?? 0) - (a.overall ?? 0)
          : (a.overall ?? 0) - (b.overall ?? 0)
      );
    } else if (sortBy === "date") {
      arr.sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return sortDir === "desc" ? tb - ta : ta - tb;
      });
    } else {
      arr.sort((a, b) => {
        const na = a.author ?? "";
        const nb = b.author ?? "";
        return sortDir === "desc" ? na.localeCompare(nb) : nb.localeCompare(na);
      });
    }
    return arr;
  }, [recent, sortBy, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortBy(key); setSortDir("desc"); }
  }

  // Full seed-idea pool for the "All examples" picker. Tabs filter by category;
  // the search box filters by text — the two combine.
  const aiExamples = useMemo(() => EXAMPLES_POOL.filter((e) => e.track === "ai-vibe"), []);
  const exampleCats = useMemo(() => {
    const present = new Set(aiExamples.map((e) => e.category));
    return (Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).filter((k) =>
      present.has(k)
    );
  }, [aiExamples]);
  const exampleResults = useMemo(() => {
    const q = exampleQuery.trim().toLowerCase();
    return aiExamples.filter((e) => {
      if (exampleCat !== "all" && e.category !== exampleCat) return false;
      if (!q) return true;
      const c = e[locale];
      return (
        c.label.toLowerCase().includes(q) ||
        c.text.toLowerCase().includes(q) ||
        CATEGORY_META[e.category][locale].toLowerCase().includes(q)
      );
    });
  }, [aiExamples, exampleQuery, exampleCat, locale]);

  async function loadRecent() {
    try {
      const res = await fetch("/api/evaluations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: PublicEvalLogEntry[] };
      setRecent(Array.isArray(data.entries) ? data.entries : []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadRecent();
    // Identity, so the popup's ProposalDetail can show owner/admin actions.
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setMe(identityFromEmail(d.email));
          setIsAdmin(d.isAdmin === true);
        }
      })
      .catch(() => {});
  }, []);

  async function saveProposal(idea: string, proposal: string) {
    if (!proposal.trim() || proposal === lastSavedRef.current) return;
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
          setSaveError(false);
        } else {
          setSaveError(true);
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
          setSaveError(false);
        } else {
          setSaveError(true);
        }
      }
      void loadRecent();
    } catch {
      // Surface the failure — the proposal exists only on this screen until a
      // retry succeeds, and Submit depends on the saved id.
      setSaveError(true);
    }
  }

  // Score the saved proposal server-side. The server grades the entry's OWN
  // stored text+proposal and persists the result — the client can't supply or
  // overwrite the score (that's what closes the submit-gate bypass). Needs a
  // saved entry id; if the earlier save failed there's nothing to score.
  async function runScore() {
    const id = savedIdRef.current;
    if (!id) {
      setScoreError(true);
      return;
    }
    setScoring(true);
    setScoreError(false);
    try {
      const res = await fetch(`/api/evaluations/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json().catch(() => null)) as { score?: EvalResult } | null;
      if (!res.ok || !data?.score) throw new Error("score_failed");
      setScore(data.score);
      void loadRecent();
    } catch {
      setScoreError(true);
    } finally {
      setScoring(false);
    }
  }

  async function submitProposal() {
    if (submitting) return;
    if (!savedIdRef.current) {
      // The initial save failed — there is no entry to submit. Point at the
      // save-retry notice instead of dying silently on a live-looking button.
      setSubmitError(t.notSavedYet);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/evaluations/${savedIdRef.current}/submit`, { method: "POST" });
      if (res.ok) {
        setStatus("submitted");
        void loadRecent();
      } else {
        // The server's refusals are meaningful (threshold can change between
        // page load and submit) — translate them instead of swallowing them.
        const data = (await res.json().catch(() => null)) as
          | { error?: string; threshold?: number }
          | null;
        setSubmitError(
          data?.error === "below_threshold"
            ? t.submitGate(typeof data.threshold === "number" ? data.threshold : threshold)
            : data?.error === "locked"
              ? t.submitLocked
              : data?.error === "forbidden"
                ? t.submitForbidden
                : t.failed
        );
      }
    } catch {
      setSubmitError(t.failed);
    } finally {
      setSubmitting(false);
    }
  }

  async function call(idea: string, history: ChatMsg[], finalize: boolean) {
    setLoading(true);
    setError(null);
    if (finalize) {
      setEditing(false);
      setBrief("");
      // Regenerating invalidates any prior score; status resets to draft.
      setScore(null);
      setScoreError(false);
      setStatus("draft");
      setSubmitError(null);
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
        // Prefer the route's human message (e.g. the rate-limit notice) over the
        // bare error code, falling back to the generic failure copy.
        throw new Error(data?.message || data?.error || t.failed);
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
        await saveProposal(idea, acc); // sets savedIdRef before scoring
        void runScore();
      } else {
        setMessages((prev) => withLastAssistant(prev, acc));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
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

  // Open the conversation once per seed.
  useEffect(() => {
    if (!seed || startedSeedRef.current === seed) return;
    startedSeedRef.current = seed;
    stickRef.current = true; // pin the new conversation to its newest turn
    setMessages([]);
    setInput("");
    setPicked([]);
    setError(null);
    setBrief(null);
    setEditing(false);
    setCopied(false);
    setSaved(false);
    setSaveError(false);
    setScore(null);
    setScoreError(false);
    setStatus("draft");
    setSubmitError(null);
    savedIdRef.current = null;
    lastSavedRef.current = "";
    void call(seed, [], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Pin the transcript to its newest turn. Instant, not smooth: smooth scrolls
  // are killed by rAF throttling in background tabs and by the layout shift
  // when the answer chips mount below — both left the latest coach question
  // sitting invisibly below the fold. A user who scrolled up stays put.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  function startSeed() {
    const idea = text.trim();
    if (idea.length < 10) {
      setSeedError(t.short);
      return;
    }
    setSeedError(null);
    setSeed(idea);
  }

  function startRandom() {
    const pool = EXAMPLES_POOL.filter((e) => e.track === "ai-vibe");
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    setSeedError(null);
    setSeed(pick[locale].text);
  }

  function restart() {
    // A live draft conversation can't be recovered once cleared — make sure
    // it's wanted. Submitted/confirmed work is already safe on the server.
    if (messages.length > 0 && status === "draft" && !window.confirm(t.restartConfirm)) return;
    stickRef.current = true; // a fresh conversation must auto-scroll again
    setSeed(null);
    startedSeedRef.current = null;
    setText("");
    setMessages([]);
    setPicked([]);
    setInput("");
    setBrief(null);
    setError(null);
    setEditing(false);
    setScore(null);
    setScoreError(false);
    setStatus("draft");
    setSaveError(false);
    setSubmitError(null);
  }

  function togglePick(opt: string) {
    setPicked((p) => (p.includes(opt) ? p.filter((x) => x !== opt) : [...p, opt]));
  }

  // Submit the answer: any picked option chips plus whatever was typed, combined
  // into one message. Clears both for the next question.
  function send() {
    const parts = [...picked];
    const typed = input.trim();
    if (typed) parts.push(typed);
    const combined = parts.join(", ");
    if (!combined || loading || !seed) return;
    const next = [...messages, { role: "user" as const, content: combined }];
    stickRef.current = true; // answering re-pins the transcript to the newest turn
    setMessages(next);
    setInput("");
    setPicked([]);
    void call(seed, next, false);
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


  async function saveEdit() {
    const v = editText.trim();
    if (!v || !seed) return;
    setBrief(v);
    setEditing(false);
    // A hand-edit is a new revision — save it, then re-score.
    setScore(null);
    setStatus("draft");
    await saveProposal(seed, v); // persists v before the server re-scores it
    void runScore();
  }

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

  // The brainstorm is a multi-turn discovery: count how many of the coach's
  // questions the user has answered, and gate "Generate proposal" on a minimum.
  const answeredCount = messages.filter((m) => m.role === "user").length;
  const canGenerate = answeredCount >= MIN_ANSWERS;

  // Pickable answer chips for the coach's most recent question (hidden while the
  // model is still streaming its reply).
  const lastMsg = messages[messages.length - 1];
  const currentOptions =
    !loading && !!seed && lastMsg?.role === "assistant" && !!lastMsg.content
      ? parseOptions(lastMsg.content).options
      : [];

  // History split: my own proposals (shown first, with scores) vs everyone
  // else's (scores are stripped server-side; rendered without the grade).
  const isMine = (e: PublicEvalLogEntry) => !!me && sameUser(e.author, me);
  const mineRecent = sortedRecent.filter(isMine);
  const othersRecent = sortedRecent.filter((e) => !isMine(e));

  // One history row. `mine` decides whether the score (mine) or the author
  // (everyone else's — scores are hidden) is shown under the title.
  const renderEntry = (e: PublicEvalLogEntry, mine: boolean) => (
    <motion.li key={e.id} variants={fadeRiseFor(reduce)}>
      <button
        type="button"
        onClick={() => setActive(e)}
        className="group block w-full py-2.5 text-left transition-colors hover:bg-panel2/30"
      >
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <div className="flex items-center gap-1">
            {/* Lifecycle: draft → submitted → approved, plus the two review
                bounce-backs (only ever the viewer's own entries — the shared
                feed never contains them) so the author spots work that needs
                attention instead of thinking it vanished. */}
            {e.status === "draft" && (
              <span className="border border-border/60 bg-panel2/40 px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted">
                {statusLabel(e.status, locale)}
              </span>
            )}
            {e.status === "submitted" && (
              <span className="inline-flex items-center gap-1 border border-border/60 bg-panel2/40 px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted">
                <Clock strokeWidth={1.8} className="h-2.5 w-2.5" />
                {statusLabel(e.status, locale)}
              </span>
            )}
            {e.status === "changes_requested" && (
              <span className="inline-flex items-center gap-1 border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-xs uppercase tracking-wide text-amber-500">
                <MessageSquare strokeWidth={1.8} className="h-2.5 w-2.5" />
                {statusLabel(e.status, locale)}
              </span>
            )}
            {e.status === "rejected" && (
              <span className="inline-flex items-center gap-1 border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs uppercase tracking-wide text-destructive">
                <Ban strokeWidth={1.8} className="h-2.5 w-2.5" />
                {statusLabel(e.status, locale)}
              </span>
            )}
            {e.status === "confirmed" && (
              <span className="inline-flex items-center gap-1 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs uppercase tracking-wide text-primary">
                <Lock strokeWidth={1.8} className="h-2.5 w-2.5" />
                {statusLabel(e.status, locale)}
              </span>
            )}
          </div>
          <span className="tabular-nums">{fmtTime(e.createdAt)}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-xs font-medium text-text decoration-primary/40 underline-offset-2 group-hover:underline">
          {e.title ?? e.text}
        </div>
        {mine
          ? e.overall > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="tabular-nums text-text/70">{e.overall.toFixed(1)} / 5</span>
                {(() => {
                  const q = entryQuadrantLabel(e, locale, quadrantThreshold);
                  return q ? <span>· {q}</span> : null;
                })()}
              </div>
            )
          : e.author && (
              <div className="mt-1 text-xs text-muted/80">
                <span className="font-mono">{displayAuthor(e.author)}</span>
              </div>
            )}
      </button>
    </motion.li>
  );

  const proposalTitle = brief ? extractTitle(brief, seed ?? "") : "";
  const busyProposal = loading && (brief === "" || brief === null);
  const phase: "idle" | "drafting" | "plotting" | "charted" =
    busyProposal || scoring ? "plotting" : score ? "charted" : seed ? "drafting" : "idle";
  const magnitude = score ? score.overall : null;

  return (
    // Star chart: a navigator's plotting table. A masthead instrument strip over
    // one bordered frame; columns split by vertical hairlines; the proposal is
    // plotted against the Impact × Feasibility sky.
    // font-scale-85 shrinks only the type (see globals.css) — Tailwind text-* are
    // rem-based so a parent font-size won't cascade; spacing/layout stay put.
    <div className="star-frame font-scale-85 relative flex min-h-0 flex-col [@media(min-height:700px)]:xl:h-[calc(100vh-8.5rem)] [@media(min-height:700px)]:xl:overflow-hidden">
      <Masthead locale={locale} phase={phase} magnitude={magnitude} />
      {/* 4 columns only at xl (≥1280px); below that they're too narrow and the
          score/history columns break, so fall back to a stacked scroll layout. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[5fr_5fr_3fr_3fr] xl:divide-x xl:divide-border/45">
      {/* ── Left: brainstorm + feedback ─────────────────────────────────── */}
      <section className="flex min-h-0 flex-col p-4 [@media(min-height:700px)]:xl:h-full">
        <div className="hairline-b mb-3 flex items-center gap-1.5 pb-2">
          <Sparkles strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
          <span className="eyebrow">{t.title}</span>
        </div>

        {!seed ? (
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-text">{t.seedLabel}</label>
              <button
                type="button"
                onClick={() => setExamplesOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 px-1.5 py-1 text-xs text-muted transition hover:text-text"
              >
                <LayoutGrid strokeWidth={1.8} className="h-3.5 w-3.5" />
                {t.allExamples}
                <span className="tabular-nums opacity-70">({aiExamples.length})</span>
              </button>
            </div>
            <SuggestionCards key="ai-vibe" track="ai-vibe" locale={locale} onPick={(v) => setText(v)} />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={t.placeholder}
              className="w-full resize-y border border-border/60 bg-panel/40 p-3 text-sm leading-relaxed text-text outline-none transition-colors placeholder:text-muted/60 focus:border-primary/60"
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={startSeed} disabled={text.trim().length < 10} className="flex-1">
                {t.start}
                <ArrowRight strokeWidth={1.8} className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="secondary" onClick={startRandom} title={t.surprise}>
                <RefreshCw strokeWidth={1.8} className="h-4 w-4" />
              </Button>
            </div>
            {seedError && <div className="mt-3 text-sm text-destructive">{seedError}</div>}
          </div>
        ) : (
          <>
            <div className="hairline-b mb-3 flex items-start justify-between gap-2 pb-3">
              <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-text/80">{seed}</p>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={restart}>
                {t.newIdea}
              </Button>
            </div>

            {/* Label-led transcript — no bubbles. Each turn sits under a small
                speaker eyebrow; whitespace separates turns. */}
            <div
              ref={scrollRef}
              onScroll={() => {
                const el = scrollRef.current;
                if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              }}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-show pr-1"
            >
              {messages.map((m, i) => {
                const streaming = i === messages.length - 1 && loading && m.role === "assistant";
                if (m.role === "user") {
                  return (
                    <div key={i} className="flex flex-col items-end">
                      <span className="eyebrow mb-1">{locale === "kr" ? "나" : "you"}</span>
                      <div className="max-w-[92%] bg-primary/10 px-3 py-2 text-sm text-text">
                        <Markdown text={m.content} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex flex-col items-start">
                    <span className="eyebrow mb-1 text-primary/70">{locale === "kr" ? "코치" : "coach"}</span>
                    {m.content === "" ? (
                      <span className="shimmer-text text-sm">{t.thinking}</span>
                    ) : (
                      <div className={`text-sm text-text/90 [&_h4]:text-text ${streaming ? "stream-caret" : ""}`}>
                        <Markdown text={parseOptions(m.content).text} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <div className="mt-2 text-xs text-destructive">{error}</div>}

            {/* Pickable answer chips for the current question (AskUserQuestion-style):
                click to answer instantly, or type your own below. */}
            {currentOptions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="eyebrow">{t.pickAnswer}</span>
                  <span className="text-xs text-muted/70">· {t.pickHint}</span>
                </div>
                {/* Capped low so the transcript above keeps real height — the
                    chips must never crowd the question they answer offscreen. */}
                <div className="flex max-h-[22vh] flex-col gap-1.5 overflow-y-auto scrollbar-show">
                  {currentOptions.map((opt, i) => {
                    const sel = picked.includes(opt);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => togglePick(opt)}
                        aria-pressed={sel}
                        className={`flex w-full items-center gap-2.5 border px-3 py-2 text-left text-sm transition-colors ${
                          sel
                            ? "border-primary/60 bg-primary/10 text-text"
                            : "border-border/60 bg-panel2/30 text-text hover:border-primary/40 hover:bg-panel2/60"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                            sel ? "border-primary bg-primary text-bg" : "border-border/70"
                          }`}
                        >
                          {sel && <Check strokeWidth={3} className="h-3 w-3" />}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                placeholder={currentOptions.length > 0 ? t.orTypeOwn : t.chatPlaceholder}
                className="min-h-[2.5rem] flex-1 resize-y border-0 border-b border-border/60 bg-transparent px-1 py-2 text-sm text-text outline-none transition-colors placeholder:text-muted/60 focus:border-primary/70"
              />
              <Button
                size="icon"
                onClick={send}
                disabled={loading || (!input.trim() && picked.length === 0)}
                title={t.send}
              >
                <Send strokeWidth={1.8} className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() => void call(seed, messages, true)}
              disabled={loading || !canGenerate}
            >
              {brief ? (
                <RefreshCw strokeWidth={1.8} className="mr-1.5 h-4 w-4" />
              ) : (
                <FileText strokeWidth={1.8} className="mr-1.5 h-4 w-4" />
              )}
              {loading && busyProposal ? t.generating : brief ? t.regenerate : t.generate}
            </Button>
            {!canGenerate && (
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
                <span className="tabular-nums">
                  {answeredCount}/{MIN_ANSWERS}
                </span>
                {t.answerGate(MIN_ANSWERS)}
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Middle: one-pager for submission ────────────────────────────── */}
      <section className="flex min-h-0 flex-col p-4 [@media(min-height:700px)]:xl:h-full">
        <div className="hairline-b mb-3 flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-1.5">
            <FileText strokeWidth={1.8} className="h-3.5 w-3.5 text-primary" />
            <span className="eyebrow">{t.onePager}</span>
          </div>
          {brief && !editing && !busyProposal && (
            <div className="flex items-center gap-1">
              {saved && (
                <span className="mr-1 hidden items-center gap-1 text-xs text-muted sm:inline-flex">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {t.saved}
                </span>
              )}
              <button
                onClick={() => {
                  setEditText(brief);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t.edit}
              </button>
              <button
                onClick={copyBrief}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.copied : t.copy}
              </button>
              <button
                onClick={() => downloadMarkdown(proposalTitle, brief)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
              >
                <Download className="h-3.5 w-3.5" />
                {t.exportMd}
              </button>
              <button
                onClick={() => printPdf(proposalTitle, brief)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted transition hover:bg-panel2/60 hover:text-text"
              >
                <Printer className="h-3.5 w-3.5" />
                {t.exportPdf}
              </button>
            </div>
          )}
        </div>

        {/* The save failed — the proposal exists only on this screen until a
            retry succeeds, and Submit needs the saved id. Keep it loud. */}
        {saveError && brief && !busyProposal && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>{t.saveFailed}</span>
            <button
              type="button"
              onClick={() => {
                if (seed && brief) void saveProposal(seed, brief);
              }}
              className="shrink-0 font-medium underline underline-offset-2 transition hover:opacity-80"
            >
              {t.retry}
            </button>
          </div>
        )}

        {/* "Thinking" bar while the proposal streams in. */}
        {busyProposal && <div className="thinking-bar mb-3" />}

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show pr-1">
          {editing ? (
            <div className="flex h-full flex-col">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-0 w-full flex-1 resize-none border border-border/60 bg-panel/40 p-3 font-mono text-xs leading-relaxed text-text outline-none transition-colors focus:border-primary/60"
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
          ) : brief ? (
            <motion.div
              className="space-y-4"
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={fadeRiseFor(reduce)} className="text-sm text-text/90">
                <Markdown text={brief} />
              </motion.div>
            </motion.div>
          ) : busyProposal ? (
            <div className="flex h-full items-center justify-center">
              <span className="shimmer-text text-sm">{t.generating}</span>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
              <FileText strokeWidth={1.4} className="h-8 w-8 opacity-40" />
              <p className="max-w-xs">{t.emptyProposal}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Scoring column ──────────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col overflow-y-auto scrollbar-show p-3 [@media(min-height:700px)]:xl:h-full">
        <div className="hairline-b mb-3 flex items-center gap-1.5 pb-2">
          <span className="eyebrow">{t.scoreLabel}</span>
        </div>
        {scoring ? (
          <div className="shimmer-text text-sm">{t.scoring}</div>
        ) : score ? (
          <div className="space-y-2">
            <StarMap score={score} locale={locale} reduce={reduce} threshold={threshold} quadrantThreshold={quadrantThreshold} />
            {status === "submitted" ? (
              <div className="flex items-center justify-center gap-1.5 border border-primary/40 bg-primary/10 py-2 text-xs text-primary">
                <Check className="h-3.5 w-3.5" />
                {statusLabel("submitted", locale)}
              </div>
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={submitProposal}
                  disabled={submitting || score.overall < threshold}
                >
                  {submitting ? t.submitting : t.submit}
                </Button>
                {score.overall < threshold && (
                  <p className="text-center text-xs text-muted">{t.submitGate(threshold)}</p>
                )}
                {submitError && (
                  <p className="text-center text-xs text-destructive">{submitError}</p>
                )}
              </>
            )}
          </div>
        ) : scoreError ? (
          <div className="space-y-2">
            <div className="text-xs text-destructive">{t.scoreError}</div>
            {seed && brief && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => void runScore()}
              >
                <RefreshCw strokeWidth={1.8} className="mr-1.5 h-3.5 w-3.5" />
                {t.rescore}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">
            {locale === "kr"
              ? "제안서를 생성하면 여기에 채점 결과가 표시됩니다."
              : "Generate a proposal to see your score here."}
          </p>
        )}
      </section>

      {/* ── History column — my proposals first, then the team's ─────────── */}
      <aside className="flex min-h-0 flex-col p-3 [@media(min-height:700px)]:xl:h-full">
        <div className="hairline-b mb-2 flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow">{t.history}</span>
            <span className="text-xs tabular-nums text-muted">({recent.length})</span>
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
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto scrollbar-show">
          {sortedRecent.length === 0 ? (
            <p className="py-3 text-xs text-muted">{t.historyEmpty}</p>
          ) : (
            <>
              {/* My proposals — gold-accented, scores shown. */}
              {mineRecent.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span
                      className="eyebrow"
                      style={{ color: "rgb(var(--c-accent-3))" }}
                    >
                      {t.myProposals}
                    </span>
                    <span className="text-xs tabular-nums text-muted">({mineRecent.length})</span>
                  </div>
                  <ul className="divide-y divide-border/40 border-l-2 pl-2" style={{ borderColor: "rgb(var(--c-accent-3) / 0.6)" }}>
                    {mineRecent.map((e) => renderEntry(e, true))}
                  </ul>
                </div>
              )}

              {/* Team history — others' proposals, scores hidden. */}
              {othersRecent.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="eyebrow">{t.teamHistory}</span>
                    <span className="text-xs tabular-nums text-muted">({othersRecent.length})</span>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {othersRecent.map((e) => renderEntry(e, false))}
                  </ul>
                </div>
              )}
            </>
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
          {locale === "kr" ? "새로고침" : "Refresh"}
        </Link>
      </aside>
      </div>

      {/* ── History popup — full proposal detail (score, edit, versions) ──── */}
      <Dialog
        open={!!active}
        onOpenChange={(open) => {
          if (!open) {
            setActive(null);
            void loadRecent();
          }
        }}
      >
        <DialogContent className="max-w-2xl border-border/70 bg-panel p-0 text-text">
          {active && (
            <div className="flex max-h-[85vh] flex-col">
              <div className="border-b border-border/60 p-5 pb-4 pr-10">
                <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">
                  {active.title ?? active.text.slice(0, 80)}
                </DialogTitle>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {/* Seed idea lives inside the scroll area so a long one stays
                    reachable — a fixed header would clip it (admin parity). */}
                <div className="mb-4 border-b border-border/60 pb-4 text-xs text-muted">
                  <span className="eyebrow">{t.seedHeading}</span>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed text-text/80">{active.text}</p>
                </div>
                {active.proposal ? (
                  <ProposalDetail initial={active} locale={locale} me={me} isAdmin={isAdmin} />
                ) : (
                  // Older entries saved before proposals were persisted — send the
                  // user to the full brainstorm page to produce one.
                  <div className="border border-border/50 bg-panel2/30 p-4 text-center text-sm text-muted">
                    <p className="mb-3">{t.emptyProposal}</p>
                    <Link
                      href={`/projects/${active.id}`}
                      className="inline-flex items-center gap-1 text-primary transition hover:underline"
                    >
                      {t.open}
                      <ArrowRight strokeWidth={1.8} className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── All-examples picker — browse + search the full seed-idea pool ──── */}
      <Dialog
        open={examplesOpen}
        onOpenChange={(open) => {
          setExamplesOpen(open);
          if (!open) {
            setExampleQuery("");
            setExampleCat("all");
          }
        }}
      >
        <DialogContent className="max-w-2xl border-border/70 bg-panel p-0 text-text">
          <div className="flex max-h-[85vh] flex-col">
            <div className="border-b border-border/60 p-5 pb-4 pr-10">
              <DialogTitle className="font-display text-lg font-semibold tracking-tight text-text">
                {t.allExamples}
                <span className="ml-2 text-sm font-normal text-muted">({exampleResults.length})</span>
              </DialogTitle>
              <div className="mt-3 flex items-center gap-2 border border-border/60 bg-panel2/40 px-2.5">
                <Search strokeWidth={1.8} className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  autoFocus
                  value={exampleQuery}
                  onChange={(ev) => setExampleQuery(ev.target.value)}
                  placeholder={t.exampleSearch}
                  className="w-full bg-transparent py-2 text-sm text-text outline-none placeholder:text-muted/60"
                />
              </div>
              {/* Category tabs — filter the list by type; combine with search. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setExampleCat("all")}
                  className={`border px-2.5 py-1 text-xs transition ${
                    exampleCat === "all"
                      ? "border-primary/55 bg-primary/15 text-text"
                      : "border-border/55 bg-panel2/30 text-muted hover:text-text"
                  }`}
                >
                  {locale === "kr" ? "전체" : "All"}
                  <span className="ml-1 tabular-nums opacity-70">{aiExamples.length}</span>
                </button>
                {exampleCats.map((cat) => {
                  const count = aiExamples.filter((e) => e.category === cat).length;
                  const active = exampleCat === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExampleCat(cat)}
                      className={`border px-2.5 py-1 text-xs transition ${
                        active
                          ? "border-primary/55 bg-primary/15 text-text"
                          : "border-border/55 bg-panel2/30 text-muted hover:text-text"
                      }`}
                    >
                      {CATEGORY_META[cat][locale]}
                      <span className="ml-1 tabular-nums opacity-70">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show p-3">
              {exampleResults.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted">{t.exampleEmpty}</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {exampleResults.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setText(ex[locale].text);
                          setExamplesOpen(false);
                          setExampleQuery("");
                        }}
                        className="group block w-full px-2 py-3 text-left transition-colors hover:bg-panel2/40"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex w-fit shrink-0 items-center border border-border/55 bg-panel/60 px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
                            {CATEGORY_META[ex.category][locale]}
                          </span>
                          <span className="text-sm font-medium text-text group-hover:text-primary">
                            {ex[locale].label}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                          {ex[locale].text}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
