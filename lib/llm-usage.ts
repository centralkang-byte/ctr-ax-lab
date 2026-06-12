import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sql } from "./db";

// Append-only log of LLM calls (the coach `/api/detail` + the scorer), used for
// two things: per-user hourly RATE LIMITING (cap runaway cost — outside-voice
// finding #7) and simple USAGE VISIBILITY (who / when / which route / model).
// Mirrors the eval-log store: Neon Postgres when a connection string is present,
// a JSON file under data/ for local dev. The file fallback is per-process (fine
// for a single dev server); production rate limiting relies on Neon being shared
// across instances.

export type LlmRoute = "detail" | "score";

export interface LlmUsageRow {
  id: string;
  submitter: string; // the signed-in user's email id ("" when unattributable)
  route: LlmRoute;
  model: string;
  tokensIn: number | null; // reserved for future token capture (best-effort)
  tokensOut: number | null;
  at: string; // ISO
}

// Per-user hourly caps, env-overridable so they can be tuned without a redeploy.
// Defaults: the coach is multi-turn (a real interview is ~6–10 calls) so it gets
// more headroom; scoring is heavier and less frequent, so it's capped tighter.
export const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function rateLimitPerHour(route: LlmRoute): number {
  return route === "detail"
    ? envInt("RATE_LIMIT_DETAIL_PER_HOUR", 40)
    : envInt("RATE_LIMIT_SCORE_PER_HOUR", 20);
}

// Pure: given how many calls the user already made in the window, is the NEXT
// one over the limit? `priorCount` of `cap` means the cap is already used up, so
// exactly `cap` calls are allowed per window. Unit-tested in isolation.
export function isOverLimit(priorCount: number, cap: number): boolean {
  return priorCount >= cap;
}

const DATA_DIR = path.join(process.cwd(), "data");
const USAGE_FILE = path.join(DATA_DIR, "llm-usage.json");

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists llm_usage (
          id text primary key,
          submitter text not null default '',
          route text not null,
          model text not null default '',
          tokens_in int,
          tokens_out int,
          at timestamptz not null default now()
        )
      `;
      // Indexed on the exact rate-limit lookup (a user's recent calls on a route).
      await sql`create index if not exists llm_usage_rate_idx on llm_usage (submitter, route, at)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function fileRead(): LlmUsageRow[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8"));
    return Array.isArray(parsed) ? (parsed as LlmUsageRow[]) : [];
  } catch {
    return [];
  }
}

function fileAppend(row: LlmUsageRow) {
  const rows = fileRead();
  rows.push(row);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USAGE_FILE, JSON.stringify(rows, null, 2) + "\n", "utf-8");
}

// Record one LLM call. NEVER throws — a usage-store hiccup must not break the
// chat/score action it follows (mirrors notify.ts's fail-safe contract).
export async function logLlmCall(input: {
  submitter: string;
  route: LlmRoute;
  model: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
}): Promise<void> {
  const row: LlmUsageRow = {
    id: randomUUID(),
    submitter: input.submitter || "",
    route: input.route,
    model: input.model || "",
    tokensIn: input.tokensIn ?? null,
    tokensOut: input.tokensOut ?? null,
    at: new Date().toISOString(),
  };
  try {
    if (sql) {
      await ensureSchema();
      await sql`
        insert into llm_usage (id, submitter, route, model, tokens_in, tokens_out, at)
        values (${row.id}, ${row.submitter}, ${row.route}, ${row.model}, ${row.tokensIn}, ${row.tokensOut}, ${row.at})
      `;
    } else {
      fileAppend(row);
    }
  } catch (err) {
    console.error("llm-usage log failed:", err);
  }
}

// How many calls this user made on this route since `sinceIso`. Returns 0 (fail
// OPEN) on any store error — a usage-store hiccup must not block legitimate use.
async function countCallsSince(submitter: string, route: LlmRoute, sinceIso: string): Promise<number> {
  try {
    if (sql) {
      await ensureSchema();
      const rows = (await sql`
        select count(*)::int as n from llm_usage
        where submitter = ${submitter} and route = ${route} and at >= ${sinceIso}
      `) as { n: number }[];
      return rows[0]?.n ?? 0;
    }
    const since = Date.parse(sinceIso);
    return fileRead().filter(
      (r) => r.submitter === submitter && r.route === route && Date.parse(r.at) >= since
    ).length;
  } catch (err) {
    console.error("llm-usage count failed:", err);
    return 0;
  }
}

export interface RateLimitResult {
  allowed: boolean;
  cap: number;
  count: number; // prior calls in the window
}

// Decide whether `submitter` may make another `route` call right now. An empty
// submitter (unattributable request) is never rate-limited — fail open on
// identity rather than block a signed-in user we just couldn't key.
export async function checkRateLimit(submitter: string, route: LlmRoute): Promise<RateLimitResult> {
  const cap = rateLimitPerHour(route);
  if (!submitter) return { allowed: true, cap, count: 0 };
  const sinceIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const count = await countCallsSince(submitter, route, sinceIso);
  return { allowed: !isOverLimit(count, cap), cap, count };
}
