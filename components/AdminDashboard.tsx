"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Cpu, History, Grid2x2, Save, Check, AlertTriangle, Trash2, Lock, Clock, FileText, Users, UserPlus, ShieldCheck, MessageSquare, Ban, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProposalDetail from "@/components/ProposalDetail";
import ScorePanel from "@/components/ScorePanel";
import QuadrantMap from "@/components/QuadrantMap";
import ProgressBoard from "@/components/ProgressBoard";
import { UI_TAB_STYLES } from "@/lib/ui-standards";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { TRACKS } from "@/lib/evaluator-meta";
import {
  SUBMIT_THRESHOLD_MIN,
  SUBMIT_THRESHOLD_MAX,
  QUADRANT_THRESHOLD_MIN,
  QUADRANT_THRESHOLD_MAX,
  DEFAULT_QUADRANT_THRESHOLD,
  quadrantLabelForGroups,
} from "@/lib/scoring";
import type { ProviderDef, LlmConfig } from "@/lib/llm/catalog";
import type { StoredSettings } from "@/lib/settings";
import type { EvalLogEntry, PublicEvalLogEntry } from "@/lib/eval-log";
import { ALLOWED_DOMAINS, PRIMARY_DOMAIN, identityFromEmail, displayAuthor } from "@/lib/identity";

type Tab = "model" | "history" | "map" | "progress" | "users";

// Configured Workspace domain(s), for the admin-grant placeholder and error copy.
const DOMAIN_HINT = PRIMARY_DOMAIN || "example.com";
const DOMAINS_HINT = ALLOWED_DOMAINS.length
  ? ALLOWED_DOMAINS.map((d) => `@${d}`).join(" / ")
  : "@example.com";

const STR = {
  kr: {
    title: "관리자",
    subtitle: "LLM 모델과 평가 기록을 관리합니다.",
    tabModel: "LLM 모델 설정",
    tabHistory: "프로젝트 기록",
    tabMap: "우선순위 맵",
    tabProgress: "진척 현황",
    tabUsers: "사용자 관리",
    usersBlurb: "관리자 페이지에 접근할 수 있는 사용자입니다. 기본 관리자는 해제할 수 없습니다.",
    emailPlaceholder: `name@${DOMAIN_HINT}`,
    add: "추가",
    adding: "추가 중…",
    defaultAdmin: "기본 관리자",
    adminAddedBy: "추가한 사람",
    removeAdmin: "권한 해제",
    confirmRemoveAdmin: "이 사용자의 관리자 권한을 해제할까요?",
    addFailed: "추가에 실패했습니다.",
    removeFailed: "해제에 실패했습니다.",
    errInvalidEmail: "올바른 이메일 주소가 아닙니다.",
    errWrongDomain: `${DOMAINS_HINT} 계정만 추가할 수 있습니다.`,
    errCannotRemove: "기본 관리자는 해제할 수 없습니다.",
    provider: "제공자",
    keyMissing: "API 키 미설정",
    keyMissingNote: "이 제공자의 API 키가 환경 변수에 설정되어 있지 않습니다. 저장해도 채점·코치 기능이 동작하지 않습니다.",
    model: "모델",
    temperature: "Temperature",
    maxTokens: "최대 토큰",
    submitThreshold: "제출 기준 점수",
    submitThresholdNote: "제안서를 팀 기록에 제출하려면 필요한 최소 종합 점수(0~5)입니다.",
    quadrantThreshold: "사분면 경계 점수",
    quadrantThresholdNote: "우선순위 맵에서 '높음'으로 나누는 기준(2.5~4.5)입니다. 임팩트·실현가능성이 이 값 이상이면 높은 쪽 사분면에 들어갑니다.",
    save: "저장",
    saving: "저장 중…",
    saved: "저장됨",
    saveFailed: "저장에 실패했습니다.",
    lastUpdated: "마지막 변경",
    reasoningNote: "추론 모델은 temperature를 지원하지 않아 비활성화됩니다.",
    graphNote: "선택한 모델은 LangGraph 판정 노드(judge)에 연결됩니다.",
    allUsers: "전체",
    statusAll: "전체 상태",
    statusPending: "검토 대기",
    statusChanges: "수정 요청",
    statusSelected: "승인됨",
    statusRejected: "선정 안 됨",
    noHistory: "기록이 없습니다.",
    by: "작성자",
    verdict: "판정",
    loading: "불러오는 중…",
    delete: "삭제",
    confirmDelete: "이 기록을 영구적으로 삭제할까요? 되돌릴 수 없습니다.",
    deleteFailed: "삭제에 실패했습니다.",
    selectPrompt: "왼쪽에서 제안서를 선택하면 여기에 내용이 표시됩니다.",
    seed: "씨앗 아이디어",
  },
  en: {
    title: "Admin",
    subtitle: "Manage the LLM model and evaluation history.",
    tabModel: "LLM Model Setup",
    tabHistory: "Project History",
    tabMap: "Priority Map",
    tabProgress: "Progress",
    tabUsers: "Users",
    usersBlurb: "Who can access the admin pages. The default admin can't be removed.",
    emailPlaceholder: `name@${DOMAIN_HINT}`,
    add: "Add",
    adding: "Adding…",
    defaultAdmin: "Default",
    adminAddedBy: "Added by",
    removeAdmin: "Revoke access",
    confirmRemoveAdmin: "Revoke admin access for this user?",
    addFailed: "Failed to add.",
    removeFailed: "Failed to remove.",
    errInvalidEmail: "That isn't a valid email address.",
    errWrongDomain: `Only ${DOMAINS_HINT} accounts can be added.`,
    errCannotRemove: "The default admin can't be removed.",
    provider: "Provider",
    keyMissing: "API key not set",
    keyMissingNote: "This provider's API key isn't configured in the environment. Saving won't make scoring or the coach work.",
    model: "Model",
    temperature: "Temperature",
    maxTokens: "Max tokens",
    submitThreshold: "Submit score gate",
    submitThresholdNote: "Minimum overall score (0–5) a proposal needs before it can be submitted to the team history.",
    quadrantThreshold: "Quadrant boundary",
    quadrantThresholdNote: "Where the priority map splits 'high' from 'low' (2.5–4.5). Impact/feasibility at or above this lands in a high quadrant.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    saveFailed: "Save failed.",
    lastUpdated: "Last updated",
    reasoningNote: "Reasoning models don't support temperature, so it's disabled.",
    graphNote: "The selected model is bound to the LangGraph judge node.",
    allUsers: "All",
    statusAll: "All",
    statusPending: "In review",
    statusChanges: "Changes requested",
    statusSelected: "Approved",
    statusRejected: "Not selected",
    noHistory: "No history yet.",
    by: "by",
    verdict: "Verdict",
    loading: "Loading…",
    delete: "Delete",
    confirmDelete: "Permanently delete this entry? This can't be undone.",
    deleteFailed: "Delete failed.",
    selectPrompt: "Pick a proposal on the left to read it here.",
    seed: "Seed idea",
  },
} as const;

type Strings = (typeof STR)["en" | "kr"];

function scoreColor(s: number) {
  if (s >= 4.5) return "#34d399";
  if (s >= 3.5) return "#a3e635";
  if (s >= 2.5) return "#fbbf24";
  if (s >= 1.5) return "#fb923c";
  return "#f87171";
}

export default function AdminDashboard() {
  const { locale } = useI18n();
  const t = STR[locale];
  const [tab, setTab] = useState<Tab>("history");

  const tabs: { id: Tab; label: string; Icon: typeof History }[] = [
    { id: "history", label: t.tabHistory, Icon: History },
    { id: "map", label: t.tabMap, Icon: Grid2x2 },
    { id: "progress", label: t.tabProgress, Icon: Activity },
    { id: "users", label: t.tabUsers, Icon: Users },
    { id: "model", label: t.tabModel, Icon: Cpu },
  ];

  return (
    <div className="flex min-h-0 flex-col lg:h-[calc(100vh-7.25rem)]">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </header>
      <div className="mb-5">
        <div className={UI_TAB_STYLES.rail}>
          {tabs.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative ${UI_TAB_STYLES.buttonBase} inline-flex items-center gap-1.5 ${
                  active ? "text-text" : UI_TAB_STYLES.buttonInactive
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-tab-active"
                    className="absolute inset-0 rounded-md bg-primary/15"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon strokeWidth={1.8} className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "model" ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
          <ModelSetup t={t} />
        </div>
      ) : tab === "map" ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
          <QuadrantMap locale={locale} endpoint="/api/admin/history" />
        </div>
      ) : tab === "progress" ? (
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
          <ProgressBoard locale={locale} />
        </div>
      ) : tab === "users" ? (
        <UsersView t={t} />
      ) : (
        <HistoryView t={t} locale={locale} />
      )}
    </div>
  );
}

// ── Model setup ──────────────────────────────────────────────────────────────

type ProviderWithKey = ProviderDef & { hasKey?: boolean };
type SettingsResponse = { settings: StoredSettings; providers: ProviderWithKey[] };

type SettingsForm = LlmConfig & { submitThreshold: number; quadrantThreshold: number };

function ModelSetup({ t }: { t: Strings }) {
  const [providers, setProviders] = useState<ProviderWithKey[]>([]);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string; updatedBy: string } | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SettingsResponse;
        setProviders(data.providers);
        const { updatedAt, updatedBy, ...cfg } = data.settings;
        setForm(cfg);
        setMeta({ updatedAt, updatedBy });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const providerDef = useMemo(
    () => providers.find((p) => p.id === form?.provider),
    [providers, form?.provider]
  );
  const modelDef = providerDef?.models.find((m) => m.id === form?.model);
  const reasoning = modelDef?.reasoning === true;
  // The active provider's key is configured? (undefined = older API without the
  // flag → assume present, don't block.) A keyless save is the one input that
  // silently breaks every LLM feature company-wide.
  const keyMissing = providerDef?.hasKey === false;
  // With a single curated provider the selector is just noise — only show it
  // when there's a real choice to make.
  const showProviderPicker = providers.length > 1;

  if (!form) {
    return <p className="text-sm text-muted">{t.loading}</p>;
  }

  function patch(next: Partial<SettingsForm>) {
    setForm((f) => (f ? { ...f, ...next } : f));
    setState("idle");
  }

  function pickProvider(providerId: string) {
    const p = providers.find((x) => x.id === providerId);
    if (!p) return;
    patch({ provider: p.id, model: p.models[0]?.id });
  }

  async function save() {
    if (!form) return;
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.saveFailed);
      const { updatedAt, updatedBy, ...cfg } = data.settings as StoredSettings;
      setForm(cfg);
      setMeta({ updatedAt, updatedBy });
      setState("saved");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : t.saveFailed);
    }
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "—";
    return d.toLocaleString();
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="space-y-5 border border-border/55 bg-panel/40 p-5">
        {/* Provider — only shown when more than one is offered. */}
        {showProviderPicker && (
          <div>
            <label className="eyebrow mb-1.5 block">{t.provider}</label>
            <div className="flex flex-wrap gap-1.5">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickProvider(p.id)}
                  className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm transition ${
                    form.provider === p.id
                      ? "border-primary/55 bg-primary/15 text-text"
                      : "border-border/60 bg-panel2/40 text-muted hover:text-text"
                  }`}
                >
                  {p.label}
                  {p.hasKey === false && (
                    <span className="border border-warning/50 bg-warning/10 px-1 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                      {t.keyMissing}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* API-key warning — the active provider can't actually run without it. */}
        {keyMissing && (
          <div className="flex items-start gap-2 border border-warning/50 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.keyMissingNote}</span>
          </div>
        )}

        {/* Model */}
        <div>
          <label className="eyebrow mb-1.5 block">{t.model}</label>
          <select
            value={form.model}
            onChange={(e) => patch({ model: e.target.value })}
            className="w-full border border-border/70 bg-panel2/40 px-3 py-2 text-sm text-text outline-none focus:border-primary/50"
          >
            {providerDef?.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} {m.reasoning ? "— reasoning" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Temperature */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="eyebrow">{t.temperature}</label>
            <span className="text-sm tabular-nums text-muted">{form.temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={form.temperature}
            disabled={reasoning}
            onChange={(e) => patch({ temperature: Number(e.target.value) })}
            className="w-full accent-primary disabled:opacity-40"
          />
          {reasoning && <p className="mt-1 text-xs text-muted">{t.reasoningNote}</p>}
        </div>

        {/* Max tokens */}
        <div>
          <label className="eyebrow mb-1.5 block">{t.maxTokens}</label>
          <input
            type="number"
            min={256}
            max={8192}
            step={64}
            value={form.maxTokens}
            onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
            className="w-40 border border-border/70 bg-panel2/40 px-3 py-2 text-sm text-text outline-none focus:border-primary/50"
          />
        </div>

        <p className="text-xs text-muted">{t.graphNote}</p>

        {/* Submit score gate — policy, not a model binding. */}
        <div className="border-t border-border/55 pt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-text">{t.submitThreshold}</label>
            <span className="text-sm tabular-nums text-muted">{form.submitThreshold.toFixed(1)} / 5</span>
          </div>
          <input
            type="range"
            min={SUBMIT_THRESHOLD_MIN}
            max={SUBMIT_THRESHOLD_MAX}
            step={0.5}
            value={form.submitThreshold}
            onChange={(e) => patch({ submitThreshold: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted">{t.submitThresholdNote}</p>
        </div>

        {/* Priority-map quadrant boundary — recalibrates where "high" begins. */}
        <div className="border-t border-border/55 pt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-text">{t.quadrantThreshold}</label>
            <span className="text-sm tabular-nums text-muted">{form.quadrantThreshold.toFixed(1)} / 5</span>
          </div>
          <input
            type="range"
            min={QUADRANT_THRESHOLD_MIN}
            max={QUADRANT_THRESHOLD_MAX}
            step={0.5}
            value={form.quadrantThreshold}
            onChange={(e) => patch({ quadrantThreshold: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted">{t.quadrantThresholdNote}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={state === "saving" || keyMissing} className="gap-1.5">
            {state === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {state === "saving" ? t.saving : state === "saved" ? t.saved : t.save}
          </Button>
          {meta && (
            <span className="text-xs text-muted">
              {t.lastUpdated}: {fmtTime(meta.updatedAt)}
              {meta.updatedBy ? ` · ${meta.updatedBy}` : ""}
            </span>
          )}
        </div>

        {state === "error" && (
          <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── History (master–detail) ───────────────────────────────────────────────────

type HistoryResponse = {
  entries: EvalLogEntry[];
  submitters: { submitter: string; count: number }[];
};

function toPublic(e: EvalLogEntry): PublicEvalLogEntry {
  const { submitter, ...rest } = e;
  return { ...rest, author: submitter };
}

type StatusFilter = "all" | "pending" | "changes" | "selected" | "rejected";

function HistoryView({ t, locale }: { t: Strings; locale: "kr" | "en" }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [me, setMe] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  // The admin's own quadrant boundary — so the list rows + the score panel here
  // show the same verdict the priority map does (never the stale stored string).
  const [quadrantThreshold, setQuadrantThreshold] = useState(DEFAULT_QUADRANT_THRESHOLD);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setMe(identityFromEmail(d.email));
          setIsAdmin(d.isAdmin === true);
        }
      })
      .catch(() => {});
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.quadrantThreshold === "number") setQuadrantThreshold(d.quadrantThreshold);
      })
      .catch(() => {});
  }, []);

  async function load(submitter: string | null) {
    setLoading(true);
    try {
      const qs = submitter ? `?submitter=${encodeURIComponent(submitter)}` : "";
      const res = await fetch(`/api/admin/history${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as HistoryResponse;
      setData((prev) => ({ entries: json.entries, submitters: json.submitters ?? prev?.submitters ?? [] }));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(null);
  }, []);

  const entries = data?.entries ?? [];
  const submitters = data?.submitters ?? [];

  const statusOf = (e: EvalLogEntry): StatusFilter =>
    e.status === "submitted"
      ? "pending"
      : e.status === "changes_requested"
        ? "changes"
        : e.status === "confirmed"
          ? "selected"
          : e.status === "rejected"
            ? "rejected"
            : "all"; // drafts don't reach this admin view

  const statusCounts = useMemo(() => {
    const c: Record<Exclude<StatusFilter, "all">, number> = {
      pending: 0,
      changes: 0,
      selected: 0,
      rejected: 0,
    };
    for (const e of entries) {
      const s = statusOf(e);
      if (s !== "all") c[s] += 1;
    }
    return c;
  }, [entries]);

  const visible = useMemo(
    () => (statusFilter === "all" ? entries : entries.filter((e) => statusOf(e) === statusFilter)),
    [entries, statusFilter]
  );

  // Keep a valid selection: default to the first visible entry, clear if it vanishes.
  useEffect(() => {
    if (visible.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !visible.some((e) => e.id === selectedId)) {
      setSelectedId(visible[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function pick(submitter: string | null) {
    setFilter(submitter);
    setSelectedId(null);
    void load(submitter);
  }

  async function remove(id: string) {
    if (deletingId) return;
    if (!window.confirm(t.confirmDelete)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        window.alert(t.deleteFailed);
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const gone = prev.entries.find((e) => e.id === id);
        const next = prev.entries.filter((e) => e.id !== id);
        const submitters = prev.submitters
          .map((s) => (gone && s.submitter === gone.submitter ? { ...s, count: s.count - 1 } : s))
          .filter((s) => s.count > 0);
        return { entries: next, submitters };
      });
      if (selectedId === id) setSelectedId(null);
    } catch {
      window.alert(t.deleteFailed);
    } finally {
      setDeletingId(null);
    }
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

  const selected = visible.find((e) => e.id === selectedId) ?? null;

  const statusChips: { id: StatusFilter; label: string; count: number | null }[] = [
    { id: "all", label: t.statusAll, count: null },
    { id: "pending", label: t.statusPending, count: statusCounts.pending },
    { id: "changes", label: t.statusChanges, count: statusCounts.changes },
    { id: "selected", label: t.statusSelected, count: statusCounts.selected },
    { id: "rejected", label: t.statusRejected, count: statusCounts.rejected },
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border border-border/55 bg-panel/40 lg:grid-cols-[23rem_minmax(0,1fr)_20rem] lg:divide-x lg:divide-border/45">
      {/* ── List pane ─────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col">
        {/* Submitter filter — a compact, scrollable chip row */}
        <div className="hairline-b flex items-center gap-1 overflow-x-auto p-2">
          <FilterChip active={filter === null} onClick={() => pick(null)}>
            {t.allUsers}
          </FilterChip>
          {submitters.map((s) => (
            <FilterChip key={s.submitter} active={filter === s.submitter} onClick={() => pick(s.submitter)}>
              <span className="font-mono">{s.submitter}</span>
              <span className="ml-1 tabular-nums opacity-70">{s.count}</span>
            </FilterChip>
          ))}
        </div>

        {/* Status filter — selected vs not vs pending */}
        <div className="hairline-b flex items-center gap-1 overflow-x-auto p-2">
          {statusChips.map((s) => (
            <FilterChip key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}>
              {s.label}
              {s.count !== null && <span className="ml-1 tabular-nums opacity-70">{s.count}</span>}
            </FilterChip>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
          {loading && entries.length === 0 ? (
            <p className="p-3 text-sm text-muted">{t.loading}</p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-sm text-muted">{t.noHistory}</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {visible.map((e) => {
                const active = e.id === selectedId;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={`group block w-full p-3 text-left transition-colors ${
                        active ? "bg-primary/10" : "hover:bg-panel2/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {e.status === "confirmed" && <Lock strokeWidth={1.8} className="h-3 w-3 shrink-0 text-primary" />}
                          {e.status === "submitted" && <Clock strokeWidth={1.8} className="h-3 w-3 shrink-0 text-muted" />}
                          {e.status === "changes_requested" && <MessageSquare strokeWidth={1.8} className="h-3 w-3 shrink-0 text-amber-500" />}
                          {e.status === "rejected" && <Ban strokeWidth={1.8} className="h-3 w-3 shrink-0 text-destructive" />}
                          {e.proposal && (
                            <FileText strokeWidth={1.8} className="h-3 w-3 shrink-0 text-primary/70" />
                          )}
                          <span className="truncate font-mono">{e.submitter || "—"}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">{fmtTime(e.createdAt)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs font-medium text-text">{e.title ?? e.text}</div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs">
                          {e.overall > 0 && (
                            <>
                              <span className="font-semibold tabular-nums" style={{ color: scoreColor(e.overall) }}>
                                {e.overall.toFixed(1)}
                              </span>
                              <span className="text-muted">{quadrantLabelForGroups(e.evaluation?.groupAverages, locale, quadrantThreshold) ?? e.quadrant ?? e.verdict}</span>
                            </>
                          )}
                        </span>
                        <span
                          role="button"
                          tabIndex={-1}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void remove(e.id);
                          }}
                          title={t.delete}
                          aria-label={t.delete}
                          className="rounded p-1 text-muted opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 strokeWidth={1.8} className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Content pane ──────────────────────────────────────────────────── */}
      <div className="min-h-0 overflow-y-auto scrollbar-show">
        {selected ? (
          <div className="p-5">
            <div className="hairline-b mb-4 pb-3">
              {selected.title && (
                <h2 className="font-display text-lg font-semibold tracking-tight text-text">{selected.title}</h2>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="border border-border/60 px-1.5 py-0.5 text-xs uppercase tracking-wide">
                  {TRACKS[selected.trackId]?.name[locale] ?? selected.trackId}
                </span>
                {selected.submitter && (
                  <span className="font-mono">
                    {t.by} {displayAuthor(selected.submitter)}
                  </span>
                )}
                <span className="tabular-nums">{fmtTime(selected.createdAt)}</span>
              </div>
              <div className="mt-2">
                <span className="eyebrow">{t.seed}</span>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text/85">{selected.text}</p>
              </div>
            </div>
            <ProposalDetail key={selected.id} initial={toPublic(selected)} locale={locale} me={me} isAdmin={isAdmin} hideScore />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted">
            <FileText strokeWidth={1.4} className="h-8 w-8 opacity-40" />
            <p className="max-w-xs">{t.selectPrompt}</p>
          </div>
        )}
      </div>

      {/* ── Scoring pane ──────────────────────────────────────────────────── */}
      <div className="min-h-0 overflow-y-auto scrollbar-show p-5">
        {selected?.evaluation ? (
          <>
            <div className="hairline-b mb-4 pb-2">
              <span className="eyebrow">{locale === "kr" ? "채점 결과" : "Score"}</span>
            </div>
            <ScorePanel score={selected.evaluation} locale={locale} threshold={quadrantThreshold} />
          </>
        ) : selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <p className="max-w-[13rem]">
              {locale === "kr" ? "채점 결과가 없습니다." : "No score for this proposal yet."}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted">
            <p className="max-w-[13rem]">{t.selectPrompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap border px-2.5 py-1 text-xs transition ${
        active
          ? "border-primary/55 bg-primary/15 text-text"
          : "border-border/55 bg-panel2/30 text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// ── User management ───────────────────────────────────────────────────────────

interface AdminRow {
  email: string;
  addedBy: string;
  addedAt: string;
  isDefault: boolean;
}

function UsersView({ t }: { t: Strings }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setAdmins(Array.isArray(d.admins) ? d.admins : []);
      })
      .catch(() => alive && setAdmins([]));
    return () => {
      alive = false;
    };
  }, []);

  function errMsg(code: unknown): string {
    if (code === "invalid_email") return t.errInvalidEmail;
    if (code === "wrong_domain") return t.errWrongDomain;
    if (code === "cannot_remove_default") return t.errCannotRemove;
    return t.addFailed;
  }

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    const value = email.trim();
    if (busy || !value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errMsg(data.error));
        return;
      }
      setAdmins(data.admins ?? []);
      setEmail("");
    } catch {
      setError(t.addFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove(target: string) {
    if (busy) return;
    if (!window.confirm(t.confirmRemoveAdmin)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errMsg(data.error));
        return;
      }
      setAdmins(data.admins ?? []);
    } catch {
      setError(t.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scrollbar-show">
      <div className="max-w-xl space-y-4">
        <p className="text-sm text-muted">{t.usersBlurb}</p>

        <form onSubmit={add} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder={t.emailPlaceholder}
            className="min-w-0 flex-1 border border-border/70 bg-panel2/40 px-3 py-2 text-sm text-text outline-none focus:border-primary/50"
          />
          <Button type="submit" disabled={busy || !email.trim()} className="shrink-0 gap-1.5">
            <UserPlus className="h-4 w-4" />
            {busy ? t.adding : t.add}
          </Button>
        </form>

        {error && (
          <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {admins === null ? (
          <p className="text-sm text-muted">{t.loading}</p>
        ) : (
          <ul className="divide-y divide-border/50 border border-border/55">
            {admins.map((a) => (
              <li key={a.email} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-text">{a.email}</span>
                    {a.isDefault && (
                      <span className="inline-flex shrink-0 items-center gap-1 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs uppercase tracking-wide text-primary">
                        <ShieldCheck className="h-3 w-3" /> {t.defaultAdmin}
                      </span>
                    )}
                  </div>
                  {!a.isDefault && a.addedBy && (
                    <div className="mt-0.5 text-xs text-muted">
                      {t.adminAddedBy}: {a.addedBy}
                    </div>
                  )}
                </div>
                {a.isDefault ? (
                  <Lock strokeWidth={1.8} className="h-4 w-4 shrink-0 text-muted/50" />
                ) : (
                  <button
                    type="button"
                    onClick={() => remove(a.email)}
                    disabled={busy}
                    title={t.removeAdmin}
                    aria-label={t.removeAdmin}
                    className="shrink-0 rounded p-1 text-muted transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 strokeWidth={1.8} className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

