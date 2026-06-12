import fs from "node:fs";
import path from "node:path";
import { sql } from "./db";
import { sameUser } from "./identity";
import { deleteProgressFor } from "./progress-log";
import type { Locale, TrackId, EvalResult } from "./evaluator-meta";

// Shared log of project proposals + their evaluations.
//
// On Vercel (serverless, ephemeral filesystem) a file can't persist, so when a
// Postgres connection string is present we use Neon Postgres. For local dev
// without a database we fall back to a JSON file so the feature still works.
// Both back ends expose the same async interface — call sites don't care which.
//
// Governance model: each entry moves through a status lifecycle
//   draft → submitted → { confirmed | changes_requested | rejected }
// An admin reviews a `submitted` proposal and either approves it (→ confirmed),
// requests updates (→ changes_requested, which re-opens editing for the author),
// or rejects it (→ rejected, "not selected"). `confirmed` is a permanent lock —
// once approved, the proposal, score, title and status can no longer change
// (enforced here, server-side, so the UI can't bypass it). `rejected` is
// reversible: an admin can reopen it back to `submitted`. Every review decision
// is appended to `proposal_reviews` (audit trail), and every change to the
// proposal text is snapshotted into `proposal_versions` (revision history).

export type ProposalStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "rejected"
  | "confirmed";

// The admin's decision on a review round. `reopened` is logged when a rejected
// proposal is sent back to pending — it carries no author-facing feedback.
export type ReviewDecision = "approved" | "changes_requested" | "rejected" | "reopened";

export class LockedError extends Error {
  constructor() {
    super("locked");
    this.name = "LockedError";
  }
}

export interface EvalLogEntry {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO — bumped on every change
  trackId: TrackId;
  submitter: string; // "" when anonymous — the signed-in user's email id (author)
  coworkers: string[]; // identity keys the author shared this entry with (leaders/teammates)
  text: string; // the seed idea / problem the user brought
  verdict: string;
  overall: number;
  quadrant?: string;
  title?: string; // short project title, extracted from the generated proposal
  proposal?: string; // the generated one-page proposal (markdown), when finalized
  evaluation?: EvalResult; // full rubric breakdown (per-criterion scores etc.)
  status: ProposalStatus;
  version: number; // current revision number (1-based)
  confirmedBy?: string; // admin email id who confirmed (locks the entry)
  confirmedAt?: string; // ISO
  locale: Locale;
}

// The shape exposed to the browser. The raw `submitter` key is dropped and
// re-surfaced as `author` — provenance is part of the governance model, so the
// author is shown, but callers read it from a stable, intentional field.
export type PublicEvalLogEntry = Omit<EvalLogEntry, "submitter"> & { author: string };

export function toPublicEntry({ submitter, ...rest }: EvalLogEntry): PublicEvalLogEntry {
  return { ...rest, author: submitter };
}

// Score privacy: in the shared history, everyone can SEE each other's proposals,
// but the grade (overall / quadrant / verdict / full rubric) is private to the
// author and the co-workers the author registered (a leader following the
// project). Admins see every score. This strips the score from a public entry
// when the viewer is none of those — the proposal text stays intact.
export function redactScoreFor(
  entry: PublicEvalLogEntry,
  viewerId: string,
  isAdminViewer: boolean
): PublicEvalLogEntry {
  if (isAdminViewer) return entry;
  if (entry.author && sameUser(entry.author, viewerId)) return entry;
  if (entry.coworkers.some((c) => sameUser(c, viewerId))) return entry;
  return { ...entry, overall: 0, quadrant: undefined, verdict: "", evaluation: undefined };
}

export interface ProposalVersion {
  id: string;
  evaluationId: string;
  version: number;
  title?: string;
  proposal?: string;
  evaluation?: EvalResult;
  author: string;
  note?: string;
  createdAt: string;
}

// One admin review round on a proposal. Append-only — the full back-and-forth
// across revision rounds stays visible to both the author and the admin.
export interface ProposalReview {
  id: string;
  evaluationId: string;
  version: number; // the proposal version this review was about
  decision: ReviewDecision;
  feedback: string; // reviewer's message to the author (markdown); "" for reopened
  reviewer: string; // admin email id
  createdAt: string;
}

const MAX_TEXT = 4000;
const MAX_PROPOSAL = 12000;

function nowIso(): string {
  return new Date().toISOString();
}

function serializeEvaluation(e?: EvalResult): string | null {
  return e ? JSON.stringify(e) : null;
}

function parseEvaluation(s: string | null | undefined): EvalResult | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as EvalResult;
  } catch {
    return undefined;
  }
}

// Tolerant of both back ends: the DB stores a JSON string, the file store a
// real array, and rows written before the column existed yield [].
function parseCoworkers(s: unknown): string[] {
  if (Array.isArray(s)) return s.filter((x): x is string => typeof x === "string");
  if (typeof s !== "string" || !s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function normalizeStatus(s: unknown): ProposalStatus {
  return s === "submitted" || s === "confirmed" || s === "changes_requested" || s === "rejected"
    ? s
    : "draft";
}

// ── Postgres back end (Neon) ─────────────────────────────────────────────────

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists evaluations (
          id uuid primary key,
          created_at timestamptz not null default now(),
          track_id text not null,
          submitter text not null default '',
          text text not null,
          verdict text not null default '',
          overall double precision not null default 0,
          quadrant text,
          locale text not null default 'kr'
        )
      `;
      // Additive migrations — old rows stay valid (all new columns nullable or
      // defaulted). proposals/title persist the one-pager; the rest add the
      // governance + scoring layer.
      await sql`alter table evaluations add column if not exists title text`;
      await sql`alter table evaluations add column if not exists proposal text`;
      await sql`alter table evaluations add column if not exists evaluation text`;
      await sql`alter table evaluations add column if not exists updated_at timestamptz`;
      await sql`alter table evaluations add column if not exists status text not null default 'draft'`;
      await sql`alter table evaluations add column if not exists version integer not null default 1`;
      await sql`alter table evaluations add column if not exists confirmed_by text`;
      await sql`alter table evaluations add column if not exists confirmed_at timestamptz`;
      // JSON array of identity keys the author shared the entry with.
      await sql`alter table evaluations add column if not exists coworkers text not null default '[]'`;
      // Append-only revision history.
      await sql`
        create table if not exists proposal_versions (
          id uuid primary key,
          evaluation_id uuid not null,
          version integer not null,
          title text,
          proposal text,
          evaluation text,
          author text not null default '',
          note text,
          created_at timestamptz not null default now()
        )
      `;
      await sql`create index if not exists proposal_versions_eval_idx on proposal_versions (evaluation_id, version)`;
      // Append-only admin review log (approve / request-updates / reject / reopen).
      await sql`
        create table if not exists proposal_reviews (
          id uuid primary key,
          evaluation_id uuid not null,
          version integer not null,
          decision text not null,
          feedback text not null default '',
          reviewer text not null default '',
          created_at timestamptz not null default now()
        )
      `;
      await sql`create index if not exists proposal_reviews_eval_idx on proposal_reviews (evaluation_id, created_at)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type Row = {
  id: string;
  created_at: string | Date;
  updated_at: string | Date | null;
  track_id: string;
  submitter: string;
  text: string;
  verdict: string;
  overall: number;
  quadrant: string | null;
  title: string | null;
  proposal: string | null;
  evaluation: string | null;
  status: string | null;
  version: number | null;
  confirmed_by: string | null;
  confirmed_at: string | Date | null;
  coworkers: string | null;
  locale: string;
};

function rowToEntry(r: Row): EvalLogEntry {
  const created = new Date(r.created_at).toISOString();
  return {
    id: r.id,
    createdAt: created,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : created,
    trackId: r.track_id as TrackId,
    submitter: r.submitter,
    coworkers: parseCoworkers(r.coworkers),
    text: r.text,
    verdict: r.verdict,
    overall: Number(r.overall),
    quadrant: r.quadrant ?? undefined,
    title: r.title ?? undefined,
    proposal: r.proposal ?? undefined,
    evaluation: parseEvaluation(r.evaluation),
    status: normalizeStatus(r.status),
    version: r.version && r.version > 0 ? r.version : 1,
    confirmedBy: r.confirmed_by ?? undefined,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : undefined,
    locale: (r.locale === "en" ? "en" : "kr") as Locale,
  };
}

type VersionRow = {
  id: string;
  evaluation_id: string;
  version: number;
  title: string | null;
  proposal: string | null;
  evaluation: string | null;
  author: string;
  note: string | null;
  created_at: string | Date;
};

function versionRowToEntry(r: VersionRow): ProposalVersion {
  return {
    id: r.id,
    evaluationId: r.evaluation_id,
    version: r.version,
    title: r.title ?? undefined,
    proposal: r.proposal ?? undefined,
    evaluation: parseEvaluation(r.evaluation),
    author: r.author,
    note: r.note ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

type ReviewRow = {
  id: string;
  evaluation_id: string;
  version: number;
  decision: string;
  feedback: string;
  reviewer: string;
  created_at: string | Date;
};

function normalizeDecision(d: unknown): ReviewDecision {
  return d === "approved" || d === "changes_requested" || d === "rejected" || d === "reopened"
    ? d
    : "changes_requested";
}

function reviewRowToEntry(r: ReviewRow): ProposalReview {
  return {
    id: r.id,
    evaluationId: r.evaluation_id,
    version: r.version,
    decision: normalizeDecision(r.decision),
    feedback: r.feedback ?? "",
    reviewer: r.reviewer ?? "",
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// ── File back end (local-dev fallback) ───────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const LOG_FILE = path.join(DATA_DIR, "evaluations.json");
const VERSIONS_FILE = path.join(DATA_DIR, "proposal-versions.json");
const REVIEWS_FILE = path.join(DATA_DIR, "proposal-reviews.json");

function fileReadAll(): EvalLogEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    // Backfill governance fields for any rows written by an older build.
    return (parsed as EvalLogEntry[]).map((e) => ({
      ...e,
      updatedAt: e.updatedAt ?? e.createdAt,
      status: normalizeStatus(e.status),
      version: e.version && e.version > 0 ? e.version : 1,
      coworkers: parseCoworkers(e.coworkers),
    }));
  } catch {
    return [];
  }
}

function fileWriteAll(entries: EvalLogEntry[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

function fileReadVersions(): ProposalVersion[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(VERSIONS_FILE, "utf-8"));
    return Array.isArray(parsed) ? (parsed as ProposalVersion[]) : [];
  } catch {
    return [];
  }
}

function fileWriteVersions(versions: ProposalVersion[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2) + "\n", "utf-8");
}

function fileReadReviews(): ProposalReview[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(REVIEWS_FILE, "utf-8"));
    return Array.isArray(parsed) ? (parsed as ProposalReview[]) : [];
  } catch {
    return [];
  }
}

function fileWriteReviews(reviews: ProposalReview[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2) + "\n", "utf-8");
}

// ── Version snapshots ─────────────────────────────────────────────────────────

async function writeVersion(v: Omit<ProposalVersion, "id" | "createdAt">): Promise<void> {
  const row: ProposalVersion = { id: crypto.randomUUID(), createdAt: nowIso(), ...v };
  if (sql) {
    await ensureSchema();
    await sql`
      insert into proposal_versions (id, evaluation_id, version, title, proposal, evaluation, author, note, created_at)
      values (${row.id}, ${row.evaluationId}, ${row.version}, ${row.title ?? null}, ${row.proposal ?? null},
              ${serializeEvaluation(row.evaluation)}, ${row.author}, ${row.note ?? null}, ${row.createdAt})
    `;
    return;
  }
  const all = fileReadVersions();
  all.push(row);
  fileWriteVersions(all);
}

// Update the latest snapshot in place — used when the score/title is attached to
// the same proposal text shortly after it was first saved, so the snapshot stays
// faithful without spawning a redundant version.
async function patchVersion(
  evaluationId: string,
  version: number,
  fields: { title?: string; evaluation?: EvalResult }
): Promise<void> {
  if (sql) {
    await ensureSchema();
    await sql`
      update proposal_versions
      set title = ${fields.title ?? null}, evaluation = ${serializeEvaluation(fields.evaluation)}
      where evaluation_id = ${evaluationId} and version = ${version}
    `;
    return;
  }
  const all = fileReadVersions();
  const idx = all.findIndex((v) => v.evaluationId === evaluationId && v.version === version);
  if (idx !== -1) {
    all[idx] = { ...all[idx], title: fields.title, evaluation: fields.evaluation };
    fileWriteVersions(all);
  }
}

export async function listVersions(evaluationId: string): Promise<ProposalVersion[]> {
  if (!evaluationId) return [];
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, evaluation_id, version, title, proposal, evaluation, author, note, created_at
      from proposal_versions
      where evaluation_id = ${evaluationId}
      order by version desc
    `) as VersionRow[];
    return rows.map(versionRowToEntry);
  }
  return fileReadVersions()
    .filter((v) => v.evaluationId === evaluationId)
    .sort((a, b) => b.version - a.version);
}

export async function getVersion(
  evaluationId: string,
  version: number
): Promise<ProposalVersion | null> {
  return (await listVersions(evaluationId)).find((v) => v.version === version) ?? null;
}

// ── Review rounds (append-only) ────────────────────────────────────────────────

async function writeReview(r: Omit<ProposalReview, "id" | "createdAt">): Promise<void> {
  const row: ProposalReview = { id: crypto.randomUUID(), createdAt: nowIso(), ...r };
  if (sql) {
    await ensureSchema();
    await sql`
      insert into proposal_reviews (id, evaluation_id, version, decision, feedback, reviewer, created_at)
      values (${row.id}, ${row.evaluationId}, ${row.version}, ${row.decision},
              ${row.feedback}, ${row.reviewer}, ${row.createdAt})
    `;
    return;
  }
  const all = fileReadReviews();
  all.unshift(row); // newest first
  fileWriteReviews(all);
}

// The full review history for one proposal, newest first.
export async function listReviews(evaluationId: string): Promise<ProposalReview[]> {
  if (!evaluationId) return [];
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, evaluation_id, version, decision, feedback, reviewer, created_at
      from proposal_reviews
      where evaluation_id = ${evaluationId}
      order by created_at desc
    `) as ReviewRow[];
    return rows.map(reviewRowToEntry);
  }
  return fileReadReviews()
    .filter((r) => r.evaluationId === evaluationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Public interface ─────────────────────────────────────────────────────────

export async function appendEvaluation(
  input: Omit<EvalLogEntry, "id" | "createdAt" | "updatedAt" | "status" | "version" | "coworkers">
): Promise<EvalLogEntry> {
  const ts = nowIso();
  const entry: EvalLogEntry = {
    id: crypto.randomUUID(),
    createdAt: ts,
    updatedAt: ts,
    status: "draft",
    version: 1,
    coworkers: [], // shared explicitly by the author later, never at creation
    trackId: input.trackId,
    submitter: (input.submitter ?? "").trim().slice(0, 80),
    text: (input.text ?? "").trim().slice(0, MAX_TEXT),
    verdict: (input.verdict ?? "").slice(0, 200),
    overall: Number.isFinite(input.overall) ? input.overall : 0,
    quadrant: input.quadrant,
    title: (input.title ?? "").trim().slice(0, 200) || undefined,
    proposal: (input.proposal ?? "").trim().slice(0, MAX_PROPOSAL) || undefined,
    evaluation: input.evaluation,
    locale: input.locale,
  };

  if (sql) {
    await ensureSchema();
    await sql`
      insert into evaluations
        (id, created_at, updated_at, track_id, submitter, text, verdict, overall, quadrant,
         title, proposal, evaluation, status, version, locale)
      values
        (${entry.id}, ${entry.createdAt}, ${entry.updatedAt}, ${entry.trackId}, ${entry.submitter},
         ${entry.text}, ${entry.verdict}, ${entry.overall}, ${entry.quadrant ?? null},
         ${entry.title ?? null}, ${entry.proposal ?? null}, ${serializeEvaluation(entry.evaluation)},
         ${entry.status}, ${entry.version}, ${entry.locale})
    `;
  } else {
    const all = fileReadAll();
    all.unshift(entry); // newest first
    fileWriteAll(all.slice(0, 500));
  }

  if (entry.proposal) {
    await writeVersion({
      evaluationId: entry.id,
      version: entry.version,
      title: entry.title,
      proposal: entry.proposal,
      evaluation: entry.evaluation,
      author: entry.submitter,
    });
  }
  return entry;
}

// Patch the proposal / title / score on an existing entry. Bumps the version and
// snapshots a new revision when the proposal TEXT changes; otherwise updates in
// place (and keeps the latest snapshot faithful). Throws LockedError once the
// entry is confirmed. Fields left undefined are kept as-is.
export async function updateEvaluation(
  id: string,
  fields: { title?: string; proposal?: string; evaluation?: EvalResult }
): Promise<EvalLogEntry | null> {
  if (!id) return null;
  const existing = await getEvaluation(id);
  if (!existing) return null;
  if (existing.status === "confirmed") throw new LockedError();

  const nextTitle =
    fields.title !== undefined ? (fields.title.trim().slice(0, 200) || undefined) : existing.title;
  const nextProposal =
    fields.proposal !== undefined
      ? (fields.proposal.trim().slice(0, MAX_PROPOSAL) || undefined)
      : existing.proposal;
  const nextEval = fields.evaluation !== undefined ? fields.evaluation : existing.evaluation;

  const proposalChanged = fields.proposal !== undefined && nextProposal !== existing.proposal;
  const nextVersion = proposalChanged ? existing.version + 1 : existing.version;
  const overall = nextEval?.overall ?? existing.overall;
  const quadrant = nextEval?.quadrant ?? existing.quadrant;
  const verdict = nextEval?.verdict ?? existing.verdict;
  const updatedAt = nowIso();

  const updated: EvalLogEntry = {
    ...existing,
    title: nextTitle,
    proposal: nextProposal,
    evaluation: nextEval,
    overall,
    quadrant,
    verdict,
    version: nextVersion,
    updatedAt,
  };

  if (sql) {
    await ensureSchema();
    await sql`
      update evaluations
      set title = ${nextTitle ?? null}, proposal = ${nextProposal ?? null},
          evaluation = ${serializeEvaluation(nextEval)}, overall = ${overall},
          quadrant = ${quadrant ?? null}, verdict = ${verdict}, version = ${nextVersion},
          updated_at = ${updatedAt}
      where id = ${id}
    `;
  } else {
    const all = fileReadAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = updated;
    fileWriteAll(all);
  }

  if (proposalChanged && nextProposal) {
    await writeVersion({
      evaluationId: id,
      version: nextVersion,
      title: nextTitle,
      proposal: nextProposal,
      evaluation: nextEval,
      author: existing.submitter,
    });
  } else if (nextProposal) {
    // Same proposal text — keep the latest snapshot's score/title current.
    await patchVersion(id, nextVersion, { title: nextTitle, evaluation: nextEval });
  }
  return updated;
}

// Replace the co-worker list (identity keys) on an entry. Sharing is metadata,
// not content: it intentionally stays editable after `confirmed` — registering a
// leader on an approved project is the primary use case — so unlike proposal
// edits there is no LockedError here. Callers gate ownership and normalize the
// keys (see the coworkers route); this just dedupes, drops the author, and caps.
const MAX_COWORKERS = 10;

export async function setCoworkers(id: string, coworkers: string[]): Promise<EvalLogEntry | null> {
  const existing = await getEvaluation(id);
  if (!existing) return null;
  const next = [...new Set(coworkers.map((c) => c.trim().toLowerCase().slice(0, 80)).filter(Boolean))]
    .filter((c) => !sameUser(c, existing.submitter))
    .slice(0, MAX_COWORKERS);
  const at = nowIso();
  if (sql) {
    await ensureSchema();
    await sql`update evaluations set coworkers = ${JSON.stringify(next)}, updated_at = ${at} where id = ${id}`;
  } else {
    const all = fileReadAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], coworkers: next, updatedAt: at };
    fileWriteAll(all);
  }
  return getEvaluation(id);
}

// Move a draft to `submitted`. The overall-score gate is enforced by the caller
// (the submit route) since it owns the policy; this just transitions the state.
export async function submitEvaluation(id: string): Promise<EvalLogEntry | null> {
  const existing = await getEvaluation(id);
  if (!existing) return null;
  // Submit is only legal from the author-editable states. A `rejected` entry
  // is reversible only by an admin reopen (decision "reopened") — letting the
  // author re-submit it directly would bypass that gate; `submitted`/`confirmed`
  // are already past this step. Throw the same LockedError the routes map to 409.
  if (existing.status !== "draft" && existing.status !== "changes_requested") {
    throw new LockedError();
  }
  return setStatus(id, "submitted");
}

// Admin review — the single entry point for every review decision. Maps a
// decision onto a status transition and appends an audit row to proposal_reviews:
//   approved          → confirmed   (terminal lock; sets confirmed_by/at)
//   changes_requested → changes_requested (re-opens editing for the author)
//   rejected          → rejected    ("not selected"; reversible)
//   reopened          → submitted   (rejected → back in the review queue)
// Transitions are validated server-side so the UI can't drive an illegal one.
// Approving an already-confirmed entry is idempotent (no duplicate review row).
export async function reviewEvaluation(
  id: string,
  adminId: string,
  decision: ReviewDecision,
  feedback = ""
): Promise<EvalLogEntry | null> {
  const existing = await getEvaluation(id);
  if (!existing) return null;

  // Idempotent re-approve of an already-locked entry.
  if (decision === "approved" && existing.status === "confirmed") return existing;

  // Legal source states per decision.
  const fromOk =
    decision === "reopened" ? existing.status === "rejected" : existing.status === "submitted";
  if (!fromOk) throw new LockedError();

  const nextStatus: ProposalStatus =
    decision === "approved"
      ? "confirmed"
      : decision === "changes_requested"
        ? "changes_requested"
        : decision === "rejected"
          ? "rejected"
          : "submitted"; // reopened

  const at = nowIso();
  const note = feedback.slice(0, MAX_PROPOSAL);

  if (decision === "approved") {
    if (sql) {
      await ensureSchema();
      await sql`
        update evaluations
        set status = 'confirmed', confirmed_by = ${adminId}, confirmed_at = ${at}, updated_at = ${at}
        where id = ${id}
      `;
    } else {
      const all = fileReadAll();
      const idx = all.findIndex((e) => e.id === id);
      if (idx === -1) return null;
      all[idx] = { ...all[idx], status: "confirmed", confirmedBy: adminId, confirmedAt: at, updatedAt: at };
      fileWriteAll(all);
    }
  } else {
    await setStatus(id, nextStatus);
  }

  await writeReview({
    evaluationId: id,
    version: existing.version,
    decision,
    feedback: decision === "reopened" ? "" : note,
    reviewer: adminId,
  });
  return getEvaluation(id);
}

// Admin confirm — kept as a thin alias over reviewEvaluation for existing callers.
export async function confirmEvaluation(
  id: string,
  adminId: string,
  feedback = ""
): Promise<EvalLogEntry | null> {
  return reviewEvaluation(id, adminId, "approved", feedback);
}

async function setStatus(id: string, status: ProposalStatus): Promise<EvalLogEntry | null> {
  const at = nowIso();
  if (sql) {
    await ensureSchema();
    await sql`update evaluations set status = ${status}, updated_at = ${at} where id = ${id}`;
  } else {
    const all = fileReadAll();
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], status, updatedAt: at };
    fileWriteAll(all);
  }
  return getEvaluation(id);
}

// Restore an old revision: append it as a NEW highest version (history stays
// append-only) and point the live entry at it. Blocked once confirmed.
export async function restoreVersion(id: string, version: number): Promise<EvalLogEntry | null> {
  const existing = await getEvaluation(id);
  if (!existing) return null;
  if (existing.status === "confirmed") throw new LockedError();
  const snap = await getVersion(id, version);
  if (!snap) return null;
  return updateEvaluation(id, {
    title: snap.title ?? "",
    proposal: snap.proposal ?? "",
    evaluation: snap.evaluation,
  });
}

export async function getEvaluation(id: string): Promise<EvalLogEntry | null> {
  if (!id) return null;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, created_at, updated_at, track_id, submitter, text, verdict, overall, quadrant,
             title, proposal, evaluation, status, version, confirmed_by, confirmed_at, coworkers, locale
      from evaluations
      where id = ${id}
      limit 1
    `) as Row[];
    return rows[0] ? rowToEntry(rows[0]) : null;
  }
  return fileReadAll().find((e) => e.id === id) ?? null;
}

// The shared, user-facing history. A proposal stays a private draft until it is
// submitted — only `submitted` and `confirmed` entries appear here, so drafts
// (and legacy scored-but-unsubmitted rows) never clutter the list.
export async function listEvaluations(limit = 50): Promise<EvalLogEntry[]> {
  const n = Math.max(1, Math.min(200, limit));
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, created_at, updated_at, track_id, submitter, text, verdict, overall, quadrant,
             title, proposal, evaluation, status, version, confirmed_by, confirmed_at, coworkers, locale
      from evaluations
      where status in ('submitted', 'confirmed')
      order by created_at desc
      limit ${n}
    `) as Row[];
    return rows.map(rowToEntry);
  }
  return fileReadAll()
    .filter((e) => e.status === "submitted" || e.status === "confirmed")
    .slice(0, n);
}

// ── Admin: cross-user history ────────────────────────────────────────────────
// These intentionally keep the `submitter` field. They are only ever called
// from admin-gated routes (see lib/admin.ts), never the public log endpoint.

export async function listAllEvaluations(
  submitter?: string,
  limit = 200,
  opts: { submittedOnly?: boolean } = {}
): Promise<EvalLogEntry[]> {
  const n = Math.max(1, Math.min(500, limit));
  const who = (submitter ?? "").trim();
  let entries: EvalLogEntry[];
  if (sql) {
    await ensureSchema();
    const rows = (who
      ? await sql`
          select id, created_at, updated_at, track_id, submitter, text, verdict, overall, quadrant,
                 title, proposal, evaluation, status, version, confirmed_by, confirmed_at, coworkers, locale
          from evaluations
          where submitter = ${who}
          order by created_at desc
          limit ${n}
        `
      : await sql`
          select id, created_at, updated_at, track_id, submitter, text, verdict, overall, quadrant,
                 title, proposal, evaluation, status, version, confirmed_by, confirmed_at, coworkers, locale
          from evaluations
          order by created_at desc
          limit ${n}
        `) as Row[];
    entries = rows.map(rowToEntry);
  } else {
    const all = fileReadAll();
    entries = (who ? all.filter((e) => e.submitter === who) : all).slice(0, n);
  }
  // Admin views show only submissions (submitted/confirmed), hiding private drafts.
  return opts.submittedOnly ? entries.filter((e) => e.status !== "draft") : entries;
}

// Permanently remove one entry. Admin-only (callers must gate on isAdmin) — a
// hard delete with no soft-delete/undo, matching the simple shared-log model.
// Returns true if a row was removed, false if the id didn't exist.
export async function deleteEvaluation(id: string): Promise<boolean> {
  if (!id) return false;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      delete from evaluations
      where id = ${id}
      returning id
    `) as { id: string }[];
    // Clean up the entry's version + review + progress history too.
    await sql`delete from proposal_versions where evaluation_id = ${id}`;
    await sql`delete from proposal_reviews where evaluation_id = ${id}`;
    await deleteProgressFor(id);
    return rows.length > 0;
  }
  const all = fileReadAll();
  const next = all.filter((e) => e.id !== id);
  if (next.length === all.length) return false;
  fileWriteAll(next);
  fileWriteVersions(fileReadVersions().filter((v) => v.evaluationId !== id));
  fileWriteReviews(fileReadReviews().filter((r) => r.evaluationId !== id));
  await deleteProgressFor(id);
  return true;
}

// Distinct submitter ids with their submission counts, most active first.
export async function listSubmitters(
  opts: { submittedOnly?: boolean } = {}
): Promise<{ submitter: string; count: number }[]> {
  if (sql) {
    await ensureSchema();
    const rows = (opts.submittedOnly
      ? await sql`
          select submitter, count(*)::int as count
          from evaluations
          where submitter <> '' and status <> 'draft'
          group by submitter
          order by count desc, submitter asc
        `
      : await sql`
          select submitter, count(*)::int as count
          from evaluations
          where submitter <> ''
          group by submitter
          order by count desc, submitter asc
        `) as { submitter: string; count: number }[];
    return rows.map((r) => ({ submitter: r.submitter, count: Number(r.count) }));
  }
  const counts = new Map<string, number>();
  for (const e of fileReadAll()) {
    if (!e.submitter) continue;
    if (opts.submittedOnly && e.status === "draft") continue;
    counts.set(e.submitter, (counts.get(e.submitter) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([submitter, count]) => ({ submitter, count }))
    .sort((a, b) => b.count - a.count || a.submitter.localeCompare(b.submitter));
}
