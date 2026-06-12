import fs from "node:fs";
import path from "node:path";
import { sql } from "./db";
import { DEFAULT_CONFIG, normalizeConfig, type LlmConfig } from "./llm/catalog";
import {
  DEFAULT_SUBMIT_THRESHOLD,
  clampSubmitThreshold,
  DEFAULT_QUADRANT_THRESHOLD,
  clampQuadrantThreshold,
} from "./scoring";

// Runtime LLM configuration set by the admin. Persisted as a single row in
// Postgres (id = 1) when a database is configured, or a local JSON file for dev
// without one. Reads are cached briefly so the evaluation path doesn't hit the
// database on every request; saving busts the cache immediately.

export interface StoredSettings extends LlmConfig {
  submitThreshold: number; // min overall score (0–5) required to submit a proposal
  quadrantThreshold: number; // axis score (2.5–4.5) that splits "high" on the priority map
  updatedAt: string; // ISO
  updatedBy: string; // admin email
}

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const CACHE_TTL_MS = 15_000;

let schemaReady: Promise<void> | null = null;
let cache: { value: StoredSettings; at: number } | null = null;

function ensureSchema(): Promise<void> {
  if (!sql) return Promise.resolve();
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        create table if not exists app_settings (
          id int primary key default 1,
          provider text not null default 'anthropic',
          model text not null default 'claude-sonnet-4-6',
          temperature double precision not null default 0.3,
          max_tokens int not null default 1200,
          updated_at timestamptz not null default now(),
          updated_by text not null default ''
        )
      `;
      // Additive migration for existing tables. The default is a SQL literal,
      // not a bind parameter — Postgres rejects parameters in a DDL DEFAULT
      // clause. Keep this number in sync with DEFAULT_SUBMIT_THRESHOLD (4).
      await sql`
        alter table app_settings
        add column if not exists submit_threshold double precision not null default 4
      `;
      // Same additive pattern; keep in sync with DEFAULT_QUADRANT_THRESHOLD (3.5).
      await sql`
        alter table app_settings
        add column if not exists quadrant_threshold double precision not null default 3.5
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

function defaults(): StoredSettings {
  return {
    ...DEFAULT_CONFIG,
    submitThreshold: DEFAULT_SUBMIT_THRESHOLD,
    quadrantThreshold: DEFAULT_QUADRANT_THRESHOLD,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "",
  };
}

// ── File back end (local-dev fallback) ───────────────────────────────────────

function fileRead(): StoredSettings {
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<StoredSettings>;
    return {
      ...normalizeConfig(parsed),
      submitThreshold: clampSubmitThreshold(parsed.submitThreshold),
      quadrantThreshold: clampQuadrantThreshold(parsed.quadrantThreshold),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      updatedBy: typeof parsed.updatedBy === "string" ? parsed.updatedBy : "",
    };
  } catch {
    return defaults();
  }
}

function fileWrite(s: StoredSettings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2) + "\n", "utf-8");
}

// ── Public interface ─────────────────────────────────────────────────────────

type SettingsRow = {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  submit_threshold: number;
  quadrant_threshold: number;
  updated_at: string | Date;
  updated_by: string;
};

export async function getSettings(): Promise<StoredSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  let value: StoredSettings;
  if (sql) {
    await ensureSchema();
    const rows = (await sql`
      select provider, model, temperature, max_tokens, submit_threshold, quadrant_threshold, updated_at, updated_by
      from app_settings where id = 1
    `) as SettingsRow[];
    if (rows.length === 0) {
      value = defaults();
    } else {
      const r = rows[0];
      value = {
        ...normalizeConfig({
          provider: r.provider as LlmConfig["provider"],
          model: r.model,
          temperature: Number(r.temperature),
          maxTokens: Number(r.max_tokens),
        }),
        submitThreshold: clampSubmitThreshold(r.submit_threshold),
        quadrantThreshold: clampQuadrantThreshold(r.quadrant_threshold),
        updatedAt: new Date(r.updated_at).toISOString(),
        updatedBy: r.updated_by ?? "",
      };
    }
  } else {
    value = fileRead();
  }

  cache = { value, at: Date.now() };
  return value;
}

// Just the model-binding portion, used by the evaluation graph.
export async function getActiveLlmConfig(): Promise<LlmConfig> {
  const { provider, model, temperature, maxTokens } = await getSettings();
  return { provider, model, temperature, maxTokens };
}

// The minimum overall score required to submit, enforced by the submit route.
export async function getSubmitThreshold(): Promise<number> {
  return (await getSettings()).submitThreshold;
}

// The axis score that splits "high" from "low" on the priority map. Read by the
// scorer (so a new proposal's stored quadrant honors the current boundary) and
// surfaced to the map via /api/config so recalibration shows without a redeploy.
export async function getQuadrantThreshold(): Promise<number> {
  return (await getSettings()).quadrantThreshold;
}

export async function saveSettings(
  input: Partial<LlmConfig> & { submitThreshold?: number; quadrantThreshold?: number },
  updatedBy: string
): Promise<StoredSettings> {
  const cfg = normalizeConfig(input);
  // The threshold lives outside LlmConfig; when a save omits it (e.g. a save
  // that only changes the model), keep the current value.
  const submitThreshold =
    input.submitThreshold !== undefined
      ? clampSubmitThreshold(input.submitThreshold)
      : (await getSettings()).submitThreshold;
  const quadrantThreshold =
    input.quadrantThreshold !== undefined
      ? clampQuadrantThreshold(input.quadrantThreshold)
      : (await getSettings()).quadrantThreshold;
  const updatedAt = new Date().toISOString();
  const stored: StoredSettings = { ...cfg, submitThreshold, quadrantThreshold, updatedAt, updatedBy };

  if (sql) {
    await ensureSchema();
    await sql`
      insert into app_settings (id, provider, model, temperature, max_tokens, submit_threshold, quadrant_threshold, updated_at, updated_by)
      values (1, ${cfg.provider}, ${cfg.model}, ${cfg.temperature}, ${cfg.maxTokens}, ${submitThreshold}, ${quadrantThreshold}, ${updatedAt}, ${updatedBy})
      on conflict (id) do update set
        provider = excluded.provider,
        model = excluded.model,
        temperature = excluded.temperature,
        max_tokens = excluded.max_tokens,
        submit_threshold = excluded.submit_threshold,
        quadrant_threshold = excluded.quadrant_threshold,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `;
  } else {
    fileWrite(stored);
  }

  cache = { value: stored, at: Date.now() };
  return stored;
}
