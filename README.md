# CTR AX Lab

**PRIVATE — internal CTR Group tool. Do not publish or share outside the organization.**

CTR AX Lab is CTR Group's internal AI-idea brainstorm workspace. An employee picks or types a rough AI work idea; a coach LLM interviews them (pain point → target users → deliverable → value → success metric → feasibility, plus 8 CTR-specific probes including a concrete next action); the coach generates a one-page proposal; the proposal is auto-scored on 8 TIDA-mapped criteria (임팩트 × 실현가능성, 1–5); and the employee can submit it for admin review (approve / request changes / reject). Bilingual (한국어 / English), Korean default.

## The flow

1. **아이디어 입력** — pick an example card (70 CTR cards across 8 divisions) or type a free-form idea.
2. **AI 코치 인터뷰** — the coach asks focused questions to fill the gaps: pain/frequency, affected users, end deliverable, quantified value, success metric, feasibility/risk. Eight CTR-specific probes include `timeReturned` (T×I from TIDA), `dataReadiness` (named source system = D), `buildFit` (no-code fit = A), `roleShift` (L1–L5 ladder), `outputQuality`, `strategicFit`, `systemAccess`, and `scope`.
3. **제안서 생성** — on demand, the coach produces a one-page markdown proposal (title → background → solution → value → metric → feasibility → **다음 액션**).
4. **자동 채점** — 8 criteria scored 1–5; group averages mapped to an Impact × Feasibility priority quadrant (Quick Win / Big Bet / Fill-in / Money Pit).
5. **제출** — score must meet the admin-configured threshold (pilot month 1: minimum = 0, so everyone may submit; calibrate and raise after reviewing real proposals against TIDA judgments).
6. **어드민 검토** — admin reviews at `/admin`: approve (locks the entry), request changes (re-opens for the author), or reject (reversible).

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values — see below
npm run dev                  # http://localhost:3090 → redirects to /evaluate
```

The dev server runs on **port 3090** (`next dev -p 3090`).

## Environment variables

Mirror of `.env.example` — fill in `.env.local` before the first run.

### Auth (required to sign in)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` | Allowed email domains, comma-separated (default: `ctr.co.kr`). Fail closed: empty ⇒ nobody signs in. |
| `DEFAULT_ADMIN_EMAIL` | Owner admin — always an admin, cannot be removed in the UI. |
| `AUTH_SECRET` | Random string (e.g. `npx auth secret`). |
| `AUTH_URL` | Production URL (e.g. `https://axlab.ctr.co.kr`). Required in production. |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID from the Entra app registration. |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Client secret value. |
| `AUTH_MICROSOFT_ENTRA_TENANT_ID` | Directory (tenant) ID — pinned server-side for the dual gate. |

### LLM providers

Set the key for whichever provider the admin selects at `/admin`:

| Variable | Provider |
| --- | --- |
| `ANTHROPIC_API_KEY` | Anthropic (default provider) |
| `OPENAI_API_KEY` | OpenAI |
| `GOOGLE_GENAI_API_KEY` | Google Gemini |

### Database (optional locally)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Omit to use the JSON-file fallback under `data/` (local dev only). Also accepted: `POSTGRES_URL` or any `*_DATABASE_URL` / `*_POSTGRES_URL` (Vercel Neon integration prefixes). |

### LLM defaults (optional)

Seed the starting config before anyone opens `/admin`:

| Variable | Default |
| --- | --- |
| `LLM_PROVIDER` | `anthropic` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `LLM_TEMPERATURE` | `0.3` |
| `LLM_MAX_TOKENS` | `1200` |

### Per-user rate limits (optional)

Max LLM calls per signed-in user per hour; over the limit returns HTTP 429. Caps runaway cost, and every call is logged to `llm_usage` (Neon) / `data/llm-usage.json`.

| Variable | Default |
| --- | --- |
| `RATE_LIMIT_DETAIL_PER_HOUR` | `40` (the coach — multi-turn) |
| `RATE_LIMIT_SCORE_PER_HOUR` | `20` (scoring — the heavier call) |

## Tests

```bash
npm test
```

Three vitest suites:

- **`auth-gate.test.ts`** — Entra dual-gate logic: correct tenant + domain passes, wrong tenant rejects, wrong domain rejects, missing config fails closed, `preferred_username` fallback.
- **`rubric-contract.test.ts`** — CTR criterion key order, two-group 4+4 shape, score-direction cues in model briefs, label-simplicity rule (no jargon parentheticals in UI labels), 70-card example pool integrity.
- **`scoring.test.ts`** — quadrant placement (four quadrants, boundary-inclusive threshold), `clampSubmitThreshold` (pilot minimum = 0, rounding to 0.5 steps, garbage-input fallback).

Keep all tests green. The rubric-contract suite acts as a regression guard on the TIDA criteria — a silent description change that flips scoring direction will break a test.

## Deployment

**Stack:** Vercel (hosting) + Neon Postgres (database), both under CTR accounts.

**Entra app registration (single-tenant):**

1. Register a new application in the CTR Entra admin portal — set supported account type to "Accounts in this organizational directory only."
2. Add two redirect URIs under "Web":
   - `http://localhost:3090/api/auth/callback/microsoft-entra-id` (development)
   - `https://<prod-url>/api/auth/callback/microsoft-entra-id` (production)
3. Create a client secret and copy the Application (client) ID, secret value, and Directory (tenant) ID into env vars.

**First-run checklist after deploying:**

1. The owner (`DEFAULT_ADMIN_EMAIL`) signs in — Entra SSO, no separate password.
2. Open `/admin` → confirm the Anthropic API key is configured and the model shows as `claude-sonnet-4-6`.
3. Grant `dongyub.lee@ctr.co.kr` admin access from the Admin panel.
4. Set the submit threshold to **MINIMUM (0)** for pilot month 1 per decision D8 — this lets every scored proposal be submitted regardless of score, so the team can calibrate TIDA judgments against real results before raising the bar.
5. After gathering real proposals, compare scores against manual TIDA assessments; once calibrated, raise the threshold to the agreed gate value.

## Security model

- **Dual tenant + domain gate, fail closed.** Layer 1 pins the OIDC issuer to the CTR tenant (tokens from other tenants fail before any app code runs). Layer 2 re-verifies the `tid` claim AND the email domain server-side — so a misconfigured app registration cannot silently widen access. Magic-link and other providers are not wired because they would bypass both layers. See `auth.config.ts` and `lib/auth-gate.ts`.
- **Admin re-checks server-side.** Every admin route and API handler calls `isAdmin()` on the server — the client hiding the link is not the gate.
- **Score privacy in the shared history.** `toPublicEntry()` renames the internal `submitter` field to `author` (provenance is preserved; the field name is stable and intentional). `redactScoreFor()` strips the grade (overall score, quadrant, verdict, full rubric) from entries where the viewer is neither the author nor an admin — the proposal text remains visible to everyone.

## Stack

- Next.js 15 App Router + React 19 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives in `components/ui`)
- NextAuth v5 (Microsoft Entra ID provider — single-tenant)
- LangChain + LangGraph (`@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai`, `@langchain/langgraph`)
- Neon serverless Postgres (`@neondatabase/serverless`)
- Lightweight i18n (`lib/i18n`) — Korean default, English toggle in the header
- Vitest (`npm test`)

## Routes

| Page | Purpose |
| --- | --- |
| `/` | redirects to `/evaluate` |
| `/evaluate` | 3-panel brainstorm workspace |
| `/projects/[id]` | a saved proposal |
| `/admin` | LLM setup + cross-user history + review queue (admin only) |
| `/login` | Microsoft Entra ID sign-in |

| API | Purpose |
| --- | --- |
| `POST /api/detail` | streaming coach chat + proposal generation (`finalize: true`) |
| `GET/POST /api/evaluations` | shared log: list recent / append |
| `GET/PATCH /api/evaluations/[id]` | fetch / update a saved proposal (only the original submitter may patch) |
| `POST /api/evaluations/[id]/submit` | move draft to submitted (score gate enforced here) |
| `GET/POST /api/admin/settings` | active LLM config + catalog / save (admin) |
| `GET /api/admin/history` | cross-user history with submitter ids (admin) |
| `POST /api/admin/evaluations/[id]/review` | approve / request-changes / reject / reopen (admin) |
| `GET /api/me` | lightweight identity for client chrome |
| `/api/auth/[...nextauth]` | NextAuth handlers |
