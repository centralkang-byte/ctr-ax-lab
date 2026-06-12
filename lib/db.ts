import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Shared Neon Postgres connection used by the evaluation log and the admin
// settings store. Resolving the connection string here keeps every feature on
// the same database without each module re-implementing the lookup.
//
// Vercel's Neon integration lets you pick a custom env-var prefix (e.g. STORAGE
// → STORAGE_DATABASE_URL), so rather than hard-coding one name we accept the
// standard ones first, then fall back to any "*_DATABASE_URL" / "*_POSTGRES_URL"
// that holds a postgres:// URL. The "_UNPOOLED" variant is intentionally skipped
// — we want the pooled connection.
export function resolveDatabaseUrl(): string {
  const direct = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (direct) return direct;
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (/(^|_)(DATABASE|POSTGRES)_URL$/.test(key) && /^postgres(ql)?:\/\//.test(value)) {
      return value;
    }
  }
  return "";
}

export const DATABASE_URL = resolveDatabaseUrl();

// `null` when no database is configured (local dev) — callers fall back to a
// file/in-memory back end so features keep working without Postgres.
export const sql: NeonQueryFunction<false, false> | null = DATABASE_URL ? neon(DATABASE_URL) : null;
