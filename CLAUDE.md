# CLAUDE.md

Guidance for working in this repo. **CTR AX Lab** is CTR Group's internal AI-idea brainstorm workspace. An employee picks or types an idea, a coach LLM interviews them, and the result is a scored one-page proposal that an admin can approve or reject. Access is restricted to the CTR Microsoft 365 tenant and `ctr.co.kr` email domain.

**This repo is PUBLIC** (set public by the owner on 2026-06-11). It still contains CTR division names, workflow details, and employee email references in `lib/examples.ts` — these are now world-visible by that decision. Treat everything committed here as published: never add secrets or new sensitive data, and keep real credentials in `.env.local` (gitignored) only.

## Commands

```bash
npm run dev     # next dev on port 3090 (NOT 3000)
npm run build   # next build
npm run start   # next start
npm run lint    # next lint
npm test        # vitest (5 suites) — keep all tests green
```

Verify changes by running the app (`npm run dev` → http://localhost:3090) **and** by running `npm test`.

## Environment / platform notes

- Dev machine is **macOS**. Use bash/zsh syntax.
- Without env vars set, auth blocks every page (middleware redirects to `/login`) and LLM calls fail with a clear "X is not set" error. See `.env.example` / README for the full list.
- Without a database connection string the app silently falls back to JSON files under `data/` — so it runs locally with zero DB setup.

## Architecture

Next.js 15 App Router + React 19 + TypeScript + Tailwind + shadcn/ui. The LLM path is LangChain/LangGraph; storage is Neon Postgres with a local-JSON fallback.

### Auth (read before touching routes)

Sign-in is **Microsoft Entra ID ONLY** (decision D3 / outside-voice finding #1). A magic-link or any second provider would bypass the Entra tenant gate and conditional-access/MFA policy, so none is offered or wired.

The one exception is a **dev-only local login** (`DEV_LOGIN=true` in `.env.local` AND a non-production build, both required — see `DEV_LOGIN_ENABLED` in `auth.config.ts`). It exists to test the product before the Entra registration arrives; production builds compile it out.

The gate is a two-layer check:

- **Layer 1 — issuer pinning** (`auth.config.ts`): The Entra provider is configured with an issuer URL pinned to the CTR tenant ID (`login.microsoftonline.com/<tenant>/v2.0`). Tokens from any other tenant fail OIDC validation outright. The app registration itself must be single-tenant.
- **Layer 2 — server-side `signIn` callback** (`auth.config.ts` → `lib/auth-gate.ts`): After OIDC validation, `isAllowedSignIn()` re-checks both the `tid` claim (tenant ID) and the email domain against `ALLOWED_DOMAINS`. Fails closed: missing tenant config or missing domain ⇒ no one can sign in. This layer catches any misconfigured app registration that would otherwise silently widen access.

`lib/auth-gate.ts` is pure and parameterized (no env reads) so it is unit-testable in isolation.

- `middleware.ts` — protects every route except `/login`, `/api/auth`, and static assets.
- `lib/admin.ts` — the owner is `DEFAULT_ADMIN_EMAIL` (env) plus a runtime allow-list; `isAdmin()` gates it. Admin routes/pages **must re-check `isAdmin` server-side** — never rely on the client hiding the link.
- `lib/identity.ts` — `identityFromEmail` (the author/submitter key: local part on single-domain, full email on multi-domain), `sameUser` (ownership check), `displayAuthor`. Derive identity through these — never re-`split("@")`.

### LLM stack (`lib/llm/`)

- `catalog.ts` — pure data: the curated provider/model list, `LlmConfig` type, `DEFAULT_CONFIG` (Anthropic claude-sonnet-4-6 for CTR), and `normalizeConfig()`. Safe to import client- and server-side. **Adding a provider/model starts here.**
- `models.ts` — `makeModel(cfg)` builds a concrete LangChain chat model and reads the provider's API key from env. A new provider in the catalog must also be handled in this `switch` (there is an exhaustiveness guard). Reasoning models (`reasoning: true`) get no `temperature`.
- `graph.ts` — minimal LangGraph (single `respond` node) with `runChatGraph()` and `streamChat()`.

### Settings & storage

- `lib/db.ts` — resolves the Postgres connection string flexibly and exports `sql` (a Neon client) or `null`. **`null` is the signal to use the file fallback** — every store checks `if (sql)`.
- `lib/settings.ts` — the admin's active `LlmConfig`, persisted as one row (`app_settings`) or `data/settings.json`. Short read cache (15 s); saves bust it. `getActiveLlmConfig()` is what the chat route calls.
- `lib/eval-log.ts` — the shared proposal log (`evaluations` table or `data/evaluations.json`). Schema is created and migrated additively on first use. **`submitter` (email id) is server-only** — always return `toPublicEntry()` to the client (which renames the field to `author`). Admin-only functions (`listAllEvaluations`, `listSubmitters`) keep `submitter` and are called only from admin-gated routes. Scores (overall/verdict/rubric) are redacted from non-author viewers via `redactScoreFor()` — except **co-workers** (`coworkers` on the entry: identity keys the author registered, e.g. a 팀장/본부장 following the project), who see the score. Co-workers are managed via `setCoworkers()` / the `PUT …/coworkers` route (author-only, inputs normalized by `coworkerKeyFromInput()` in `lib/identity.ts`) and **stay editable after `confirmed`** — sharing is metadata, not content, so it doesn't violate the approval lock.
- `lib/progress-log.ts` — execution-phase feed for **confirmed** proposals (`progress_updates` / `progress_comments` tables or `data/progress-*.json`). Append-only, lives NEXT TO the evaluation so it never touches the confirm lock. Permissions are pure helpers enforced in the routes: `canPostProgress` (author + co-workers), `canCommentProgress` (those + admins); reading is company-wide. Photos upload via `/api/upload` → Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, else `data/uploads/` served by `/api/uploads/[name]` (dev only). A 완료 update can report **measured monthly hours returned** (`hoursReturned` — TIDA's T, measured); the admin 진척 현황 tab (`/api/admin/progress`) aggregates the latest report per project, plus a stale flag (`isStale`, 14 quiet days). Employees get a lighter browse hub at `/projects` ("과제 현황" sidebar item, shown to everyone) backed by `/api/progress/overview` (signed-in, company-wide): per-project status (stage / last activity) + the company-wide hours-returned **total** (motivating headline). Management-only details — per-project hours, stale triage — stay on the admin board.
- `lib/notify.ts` — `notifyTeams()`: Teams channel card via `TEAMS_WEBHOOK_URL` (Power Automate webhook flow, Adaptive Card envelope). Fires on progress updates, feedback comments, and review decisions. **Never throws** — notification failures must not break the action they follow; no URL ⇒ no-op.

### Brainstorm flow

- `app/api/detail/route.ts` — the coach. Streams plain UTF-8 text. The system prompt is bilingual and built from the **CTR TIDA rubric dimensions** (`lib/evaluator-meta.ts`) used as a private probing instinct — the coach never shows scores to the user. `finalize: true` switches to emit a one-page markdown proposal whose first line is `# <title>` and whose last section is `## 다음 액션`.
- `lib/evaluator-meta.ts` — pure rubric metadata (tracks, groups, criteria, `EvalResult` types). No server-only imports — shared by client and server.

### Rubric: CTR TIDA criteria (`lib/evaluator-meta.ts`, track `"ai-vibe"`)

The `"ai-vibe"` track maps to CTR's TIDA evaluation framework. Two groups, **two criteria each (4 total)**, scored 1–5 — deliberately lean. The four dropped sub-factors are folded into the kept criteria's `desc` (the coach still probes all of them; they just aren't scored separately):

**임팩트 (Impact)**
- `timeReturned` — 되찾는 시간 (TIDA T×I: task time × frequency → monthly hours; folds in the L1–L5 role-shift ladder and output trust as value-weights)
- `strategicFit` — 전략 적합성 (faster consolidated close, cross-division connection, external fee reduction, know-how-as-asset)

**실현가능성 (Feasibility)**
- `dataReadiness` — 데이터 준비도 (TIDA D: structured, named source system)
- `buildFit` — 도구 적합성 (TIDA A: a non-engineer can build it on read-only/file access; folds in system access + right-sized scope)

**Label-simplicity rule (decision D1):** UI labels are plain Korean/English. Jargon (TIDA letters, score-direction cues, L1–L5 references) lives in `desc`, never in `label.kr` or `label.en`. The rubric-contract test suite enforces this.

### Testing (`tests/`)

Five vitest suites. Run with `npm test`. **Keep all tests green at all times.**

- `auth-gate.test.ts` — pins `isAllowedSignIn()` and `emailFromClaims()`: correct tenant + domain passes, wrong tenant rejects, wrong domain rejects, missing config fails closed, preferred_username fallback works.
- `rubric-contract.test.ts` — pins the CTR criterion key order, the two-group 2+2 shape, score-direction cues in `desc` (inverted "higher = easier" criteria must carry the phrase — dropping it would silently flip Feasibility scoring), label-simplicity rule (no parentheses in labels), and the 70-card example pool (unique IDs, 8 categories, bilingual, ≥10 chars text).
- `scoring.test.ts` — pins quadrant placement logic and the `clampSubmitThreshold` helper (pilot month-1 minimum = 0, rounding to 0.5 steps, garbage-input fallback).
- `coworker.test.ts` — pins `coworkerKeyForDomains()` normalization (allowed-domain email → author-key form, bare id only on single-domain, fail closed with no domains) and `redactScoreFor()` co-worker visibility (registered co-worker sees the score, everyone else stays redacted).
- `progress.test.ts` — pins the progress-feed permission split (updates by author + co-workers only — admins' channel is comments; comments add admins; signed-out never matches), `isStale` (missing/garbage timestamps count as stale), and `reduceOverview` (latest stage wins, hours are the latest report — never summed across updates).

### Conventions

- Path alias `@/` → repo root (`@/lib/...`, `@/components/...`).
- Bilingual everywhere: `Locale = "kr" | "en"`, Korean default. Chrome strings live in `lib/i18n/dictionary.ts`; page copy is often inlined as `STR[locale]` objects.
- API routes that touch the DB / LLM set `export const runtime = "nodejs"`.
- Comments here tend to explain *why* (trade-offs, security boundaries). Match that style — keep the security-boundary comments intact when editing auth/log code.
- shadcn/ui components live in `components/ui` (configured via `components.json`).

## Gotchas

- **Dev port is 3090**, not the Next.js default 3000. The npm script is authoritative.
- The JSON fallback (`data/*.json`) is fine for a single long-running local process but is ephemeral on serverless/multi-instance — production relies on Neon.
- When adding an LLM provider, update **both** `catalog.ts` (data) and `models.ts` (factory `switch`), and document its API-key env var in `.env.example` and README.
