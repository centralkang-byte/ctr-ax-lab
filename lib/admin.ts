import fs from "node:fs";
import path from "node:path";
import { sql } from "./db";
import { isAllowedDomain } from "./identity";

// Admin access control. Every signed-in user is a verified account on an allowed
// Workspace domain (see auth.ts / lib/identity.ts); this is a second, narrower
// gate granting access to the admin surface. The owner is configured per
// deployment via DEFAULT_ADMIN_EMAIL — always an admin and never removable;
// additional admins are granted at runtime and persisted in Postgres (or a
// local JSON file when no database is configured), so reads are cached briefly.
// With DEFAULT_ADMIN_EMAIL unset there is no built-in owner.
export const DEFAULT_ADMIN_EMAIL = (process.env.DEFAULT_ADMIN_EMAIL ?? "").trim();

export interface AdminEntry {
  email: string;
  addedBy: string; // who granted access ("" for the default owner)
  addedAt: string; // ISO
  isDefault: boolean; // the protected owner — cannot be removed
}

export class AdminError extends Error {}

const DATA_DIR = path.join(process.cwd(), "data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const CACHE_TTL_MS = 15_000;

function norm(email: string): string {
  return email.toLowerCase().trim();
}

const DEFAULT_NORM = norm(DEFAULT_ADMIN_EMAIL);

let schemaReady: Promise<void> | null = null;
let cache: { emails: Set<string>; at: number } | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists app_admins (
          email text primary key,
          added_by text not null default '',
          added_at timestamptz not null default now()
        )
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

type AdminRow = { email: string; added_by: string; added_at: string | Date };
interface StoredAdmin {
  email: string;
  addedBy: string;
  addedAt: string;
}

// ── File back end (local-dev fallback) ───────────────────────────────────────

function fileRead(): StoredAdmin[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.email === "string")
      .map((a) => ({
        email: norm(a.email),
        addedBy: typeof a.addedBy === "string" ? a.addedBy : "",
        addedAt: typeof a.addedAt === "string" ? a.addedAt : new Date(0).toISOString(),
      }));
  } catch {
    return [];
  }
}

function fileWrite(list: StoredAdmin[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(list, null, 2) + "\n", "utf-8");
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function loadStored(): Promise<StoredAdmin[]> {
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select email, added_by, added_at from app_admins order by added_at asc
    `) as AdminRow[];
    return rows.map((r) => ({
      email: norm(r.email),
      addedBy: r.added_by ?? "",
      addedAt: new Date(r.added_at).toISOString(),
    }));
  }
  return fileRead();
}

async function adminEmailSet(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.emails;
  const stored = await loadStored();
  const set = new Set(stored.map((a) => a.email));
  if (DEFAULT_NORM) set.add(DEFAULT_NORM); // the configured owner is always an admin
  cache = { emails: set, at: Date.now() };
  return set;
}

// Whether an email may access the admin surface. Async because the allow-list
// now lives in the database; server callers await it.
export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = norm(email);
  if (DEFAULT_NORM && e === DEFAULT_NORM) return true;
  return (await adminEmailSet()).has(e);
}

// The full admin list for the management UI, owner first (and flagged default).
// When no owner is configured (DEFAULT_ADMIN_EMAIL unset) the list is just the
// runtime-granted admins.
export async function listAdmins(): Promise<AdminEntry[]> {
  const rest = (await loadStored())
    .filter((a) => a.email !== DEFAULT_NORM)
    .map((a) => ({ email: a.email, addedBy: a.addedBy, addedAt: a.addedAt, isDefault: false }))
    .sort((a, b) => a.email.localeCompare(b.email));
  if (!DEFAULT_NORM) return rest;
  const owner: AdminEntry = {
    email: DEFAULT_ADMIN_EMAIL,
    addedBy: "",
    addedAt: new Date(0).toISOString(),
    isDefault: true,
  };
  return [owner, ...rest];
}

// ── Writes ─────────────────────────────────────────────────────────────────

export async function addAdmin(email: string, addedBy: string): Promise<AdminEntry[]> {
  const e = norm(email);
  if (!e || !e.includes("@")) throw new AdminError("invalid_email");
  const domain = e.slice(e.lastIndexOf("@") + 1);
  if (!isAllowedDomain(domain)) throw new AdminError("wrong_domain");
  if (e !== DEFAULT_NORM) {
    const at = new Date().toISOString();
    if (sql) {
      await ensureSchema();
      await sql`
        insert into app_admins (email, added_by, added_at)
        values (${e}, ${addedBy}, ${at})
        on conflict (email) do nothing
      `;
    } else {
      const list = fileRead();
      if (!list.some((a) => a.email === e)) {
        list.push({ email: e, addedBy, addedAt: at });
        fileWrite(list);
      }
    }
  }
  cache = null;
  return listAdmins();
}

export async function removeAdmin(email: string): Promise<AdminEntry[]> {
  const e = norm(email);
  if (e === DEFAULT_NORM) throw new AdminError("cannot_remove_default");
  if (sql) {
    await ensureSchema();
    await sql`delete from app_admins where email = ${e}`;
  } else {
    fileWrite(fileRead().filter((a) => a.email !== e));
  }
  cache = null;
  return listAdmins();
}
