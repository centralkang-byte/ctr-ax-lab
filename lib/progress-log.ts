import fs from "node:fs";
import path from "node:path";
import { sql } from "./db";
import { sameUser } from "./identity";
import type { EvalLogEntry } from "./eval-log";

// Execution-phase log for confirmed proposals: the team posts progress updates
// (text + photos), and the admin (or the team) replies with feedback comments.
// Both stores are append-only, mirroring proposal_reviews in lib/eval-log.ts.
// This lives NEXT TO the evaluation, never inside it — a confirmed proposal is
// permanently locked (content + score), and progress must not touch that lock.
//
// Same dual back end as the other stores: Neon Postgres when configured,
// data/*.json files for local dev (`sql === null` is the signal).

// Optional at-a-glance state the author attaches to an update. Plain-language
// labels live in the UI (decision D1); these keys are storage-only.
export type ProgressStage = "on_track" | "delayed" | "blocked" | "done";

export interface ProgressUpdate {
  id: string;
  evaluationId: string;
  author: string; // identity key (see lib/identity.ts)
  body: string; // markdown
  images: string[]; // uploaded image URLs (Vercel Blob in prod, /api/uploads/* in dev)
  stage?: ProgressStage;
  // Measured monthly hours actually returned (the T in TIDA, measured instead
  // of predicted) — the author reports it when closing the project out. The
  // admin board aggregates the most recent reported value per project.
  hoursReturned?: number;
  createdAt: string; // ISO
}

export interface ProgressComment {
  id: string;
  updateId: string;
  evaluationId: string; // denormalized so permission checks need one lookup
  author: string;
  body: string;
  createdAt: string;
}

const MAX_BODY = 4000;
const MAX_COMMENT = 2000;
const MAX_IMAGES = 4;

// ── Permissions (pure — pinned by tests/progress.test.ts) ────────────────────
// Reading is company-wide (same principle as proposals: text public, scores
// private). Writing is for the people running the project; feedback adds admins.

export function canPostProgress(
  entry: Pick<EvalLogEntry, "submitter" | "coworkers">,
  viewerId: string
): boolean {
  if (!viewerId) return false;
  if (!entry.submitter || sameUser(entry.submitter, viewerId)) return true;
  return entry.coworkers.some((c) => sameUser(c, viewerId));
}

export function canCommentProgress(
  entry: Pick<EvalLogEntry, "submitter" | "coworkers">,
  viewerId: string,
  isAdminViewer: boolean
): boolean {
  return isAdminViewer || canPostProgress(entry, viewerId);
}

function normalizeStage(s: unknown): ProgressStage | undefined {
  return s === "on_track" || s === "delayed" || s === "blocked" || s === "done" ? s : undefined;
}

// Reported hours must be a sane positive number — anything else is dropped
// rather than stored as garbage (the aggregate feeds a company-wide figure).
function normalizeHours(h: unknown): number | undefined {
  const n = typeof h === "string" ? Number(h) : h;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(Math.round(n * 10) / 10, 10000);
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseImages(s: unknown): string[] {
  if (Array.isArray(s)) return s.filter((x): x is string => typeof x === "string");
  if (typeof s !== "string" || !s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ── Postgres back end ────────────────────────────────────────────────────────

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists progress_updates (
          id uuid primary key,
          evaluation_id uuid not null,
          author text not null default '',
          body text not null,
          images text not null default '[]',
          stage text,
          created_at timestamptz not null default now()
        )
      `;
      await sql`create index if not exists progress_updates_eval_idx on progress_updates (evaluation_id, created_at)`;
      // Additive, like the evaluations table — older rows stay valid.
      await sql`alter table progress_updates add column if not exists hours_returned double precision`;
      await sql`
        create table if not exists progress_comments (
          id uuid primary key,
          update_id uuid not null,
          evaluation_id uuid not null,
          author text not null default '',
          body text not null,
          created_at timestamptz not null default now()
        )
      `;
      await sql`create index if not exists progress_comments_eval_idx on progress_comments (evaluation_id, created_at)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type UpdateRow = {
  id: string;
  evaluation_id: string;
  author: string;
  body: string;
  images: string | null;
  stage: string | null;
  hours_returned: number | null;
  created_at: string | Date;
};

type CommentRow = {
  id: string;
  update_id: string;
  evaluation_id: string;
  author: string;
  body: string;
  created_at: string | Date;
};

function updateRowToEntry(r: UpdateRow): ProgressUpdate {
  return {
    id: r.id,
    evaluationId: r.evaluation_id,
    author: r.author,
    body: r.body,
    images: parseImages(r.images),
    stage: normalizeStage(r.stage),
    hoursReturned: normalizeHours(r.hours_returned),
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function commentRowToEntry(r: CommentRow): ProgressComment {
  return {
    id: r.id,
    updateId: r.update_id,
    evaluationId: r.evaluation_id,
    author: r.author,
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// ── File back end (local-dev fallback) ───────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const UPDATES_FILE = path.join(DATA_DIR, "progress-updates.json");
const COMMENTS_FILE = path.join(DATA_DIR, "progress-comments.json");

function fileRead<T>(file: string): T[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function fileWrite<T>(file: string, rows: T[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(rows, null, 2) + "\n", "utf-8");
}

// ── Public interface ─────────────────────────────────────────────────────────

export async function addProgressUpdate(input: {
  evaluationId: string;
  author: string;
  body: string;
  images?: string[];
  stage?: unknown;
  hoursReturned?: unknown;
}): Promise<ProgressUpdate> {
  const row: ProgressUpdate = {
    id: crypto.randomUUID(),
    evaluationId: input.evaluationId,
    author: (input.author ?? "").trim().slice(0, 80),
    body: (input.body ?? "").trim().slice(0, MAX_BODY),
    images: (input.images ?? []).filter((u) => typeof u === "string").slice(0, MAX_IMAGES),
    stage: normalizeStage(input.stage),
    hoursReturned: normalizeHours(input.hoursReturned),
    createdAt: nowIso(),
  };
  if (sql) {
    await ensureSchema();
    await sql`
      insert into progress_updates (id, evaluation_id, author, body, images, stage, hours_returned, created_at)
      values (${row.id}, ${row.evaluationId}, ${row.author}, ${row.body},
              ${JSON.stringify(row.images)}, ${row.stage ?? null}, ${row.hoursReturned ?? null}, ${row.createdAt})
    `;
  } else {
    const all = fileRead<ProgressUpdate>(UPDATES_FILE);
    all.unshift(row); // newest first
    fileWrite(UPDATES_FILE, all);
  }
  return row;
}

// All updates for one project, newest first.
export async function listProgressUpdates(evaluationId: string): Promise<ProgressUpdate[]> {
  if (!evaluationId) return [];
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, evaluation_id, author, body, images, stage, hours_returned, created_at
      from progress_updates
      where evaluation_id = ${evaluationId}
      order by created_at desc
    `) as UpdateRow[];
    return rows.map(updateRowToEntry);
  }
  return fileRead<ProgressUpdate>(UPDATES_FILE)
    .filter((u) => u.evaluationId === evaluationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProgressUpdate(id: string): Promise<ProgressUpdate | null> {
  if (!id) return null;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, evaluation_id, author, body, images, stage, hours_returned, created_at
      from progress_updates
      where id = ${id}
      limit 1
    `) as UpdateRow[];
    return rows[0] ? updateRowToEntry(rows[0]) : null;
  }
  return fileRead<ProgressUpdate>(UPDATES_FILE).find((u) => u.id === id) ?? null;
}

export async function addProgressComment(input: {
  updateId: string;
  evaluationId: string;
  author: string;
  body: string;
}): Promise<ProgressComment> {
  const row: ProgressComment = {
    id: crypto.randomUUID(),
    updateId: input.updateId,
    evaluationId: input.evaluationId,
    author: (input.author ?? "").trim().slice(0, 80),
    body: (input.body ?? "").trim().slice(0, MAX_COMMENT),
    createdAt: nowIso(),
  };
  if (sql) {
    await ensureSchema();
    await sql`
      insert into progress_comments (id, update_id, evaluation_id, author, body, created_at)
      values (${row.id}, ${row.updateId}, ${row.evaluationId}, ${row.author}, ${row.body}, ${row.createdAt})
    `;
  } else {
    const all = fileRead<ProgressComment>(COMMENTS_FILE);
    all.push(row); // oldest first — comments read top-down under an update
    fileWrite(COMMENTS_FILE, all);
  }
  return row;
}

// All comments for one project, oldest first (grouped under updates client-side).
export async function listProgressComments(evaluationId: string): Promise<ProgressComment[]> {
  if (!evaluationId) return [];
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select id, update_id, evaluation_id, author, body, created_at
      from progress_comments
      where evaluation_id = ${evaluationId}
      order by created_at asc
    `) as CommentRow[];
    return rows.map(commentRowToEntry);
  }
  return fileRead<ProgressComment>(COMMENTS_FILE)
    .filter((c) => c.evaluationId === evaluationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ── Admin board: per-project roll-up + stale detection ───────────────────────

export interface ProgressOverviewRow {
  evaluationId: string;
  updateCount: number;
  lastUpdateAt: string;
  lastStage?: ProgressStage;
  hoursReturned?: number; // most recently reported actual (not a sum over updates)
}

// Pure reducer over updates sorted NEWEST FIRST — pinned by tests. The first
// row seen per project is its latest update; the first reported hours value
// seen is the most recent actual.
export function reduceOverview(
  updates: Pick<ProgressUpdate, "evaluationId" | "stage" | "hoursReturned" | "createdAt">[]
): ProgressOverviewRow[] {
  const byId = new Map<string, ProgressOverviewRow>();
  for (const u of updates) {
    const row = byId.get(u.evaluationId);
    if (!row) {
      byId.set(u.evaluationId, {
        evaluationId: u.evaluationId,
        updateCount: 1,
        lastUpdateAt: u.createdAt,
        lastStage: u.stage,
        hoursReturned: u.hoursReturned,
      });
    } else {
      row.updateCount += 1;
      if (row.hoursReturned === undefined) row.hoursReturned = u.hoursReturned;
    }
  }
  return [...byId.values()];
}

export async function listProgressOverview(): Promise<ProgressOverviewRow[]> {
  // Light columns over ALL updates, reduced in TS — fine at pilot scale, and
  // identical logic for both back ends.
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select evaluation_id, stage, hours_returned, created_at
      from progress_updates
      order by created_at desc
    `) as Pick<UpdateRow, "evaluation_id" | "stage" | "hours_returned" | "created_at">[];
    return reduceOverview(
      rows.map((r) => ({
        evaluationId: r.evaluation_id,
        stage: normalizeStage(r.stage),
        hoursReturned: normalizeHours(r.hours_returned),
        createdAt: new Date(r.created_at).toISOString(),
      }))
    );
  }
  return reduceOverview(
    fileRead<ProgressUpdate>(UPDATES_FILE).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

// A confirmed project with no activity for this long needs an admin nudge.
export const STALE_AFTER_DAYS = 14;

// Pure (now passed in) — pinned by tests. No activity at all, or unparseable
// timestamps, count as stale: the failure mode should attract attention, not
// hide the project from the board.
export function isStale(
  lastActivityIso: string | undefined,
  nowIso: string,
  days = STALE_AFTER_DAYS
): boolean {
  if (!lastActivityIso) return true;
  const last = Date.parse(lastActivityIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return now - last > days * 86_400_000;
}

// Cascade cleanup when an evaluation is deleted (called from deleteEvaluation).
export async function deleteProgressFor(evaluationId: string): Promise<void> {
  if (!evaluationId) return;
  if (sql) {
    await ensureSchema();
    await sql`delete from progress_updates where evaluation_id = ${evaluationId}`;
    await sql`delete from progress_comments where evaluation_id = ${evaluationId}`;
    return;
  }
  fileWrite(
    UPDATES_FILE,
    fileRead<ProgressUpdate>(UPDATES_FILE).filter((u) => u.evaluationId !== evaluationId)
  );
  fileWrite(
    COMMENTS_FILE,
    fileRead<ProgressComment>(COMMENTS_FILE).filter((c) => c.evaluationId !== evaluationId)
  );
}
