# Handover — CTR AX Lab

**Start here.** This is the entry point for the developer taking ownership. Read
this once (~3 min), then dive into the linked docs as needed.

Repo: `github.com/centralkang-byte/ctr-ax-lab` — **public** (see the warning at the
bottom).

---

## What it is

CTR's internal AI-idea workspace. An employee picks or types an idea → an AI
**coach** interviews them (Korean-first) → the result is a **scored one-page
proposal** placed on an Impact × Feasibility map → an admin **reviews and approves
or rejects** it. Approved projects get a lightweight **progress feed**. Sign-in is
restricted to the **CTR Microsoft 365 tenant + `ctr.co.kr`**.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind + shadcn/ui ·
LangChain/LangGraph (Anthropic Claude) · Neon Postgres (with a local JSON
fallback) · deploys on Vercel.

---

## Current state

- **Implementation is complete and self-contained.** All core flows work end to
  end (brainstorm → proposal → score → submit → admin review → approve → map →
  progress).
- **Quality gates green:** `npm test` = **55 tests / 7 suites**, and **CI**
  (`.github/workflows/ci.yml`) runs build + tests on every push/PR to `main`.
- **Not yet deployed to production.** The one hard blocker is the **Entra app
  registration** (CTR IT) — see "Your job" below.

---

## Run it locally (5 min, no Entra needed)

```bash
npm install
cp .env.example .env.local          # then edit .env.local (see below)
npm run dev                          # → http://localhost:3090  (NOT 3000)
npm test                             # keep this green
```

In `.env.local`, to test **without** the Entra registration, set:

```
DEV_LOGIN=true                       # local-only; compiled out of production
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=ctr.co.kr
DEFAULT_ADMIN_EMAIL=sangwoo.kang@ctr.co.kr
ANTHROPIC_API_KEY=sk-ant-...         # for the coach/scorer to actually run
```

Then the login page offers a dev login — sign in with any `@ctr.co.kr` email.
Without `DATABASE_URL`, data persists to JSON files under `data/` (fine for local;
do **not** rely on it in production).

---

## The doc map (where to look)

| Doc | What's in it |
|---|---|
| **`README.md`** | Quick run, env-var reference, security model, route list. |
| **`CLAUDE.md`** | The architecture bible — module-by-module, with the *why* behind the security boundaries (auth gate, score redaction, confirm-lock). Read this before touching auth or the eval log. |
| **`DEPLOY.md`** | Production runbook: Entra ID + Neon + Vercel, env checklist, first-run, smoke test, troubleshooting. |
| **`TODOS.md`** | What's shipped vs. what's open (CI, rate-limiting, quadrant threshold are done; error-i18n + data-retention policy remain). |

---

## Your job (to get it live)

1. **Production deploy** — follow `DEPLOY.md`. Needs CTR-owned **Vercel + Neon +
   Anthropic** accounts and the **Entra app registration from CTR IT** (single
   tenant; redirect URI `…/api/auth/callback/microsoft-entra-id`). This is the
   blocker for real sign-in.
2. **Vercel Blob** — provision it so progress-update **photos** persist (otherwise
   they vanish on redeploy). `TODOS.md` item A.
3. **Teams webhook** — create the Power Automate flow in the CTR tenant and set
   `TEAMS_WEBHOOK_URL` so notifications actually fire (no-op until then).
   `TODOS.md` item B.
4. **Remaining backlog** (not blocking): `TODOS.md` #2 (localize API error
   messages, P3 — do if pilot users complain) and #5 (data-retention/deletion
   policy — policy work, not code).

---

## Credentials & access (deliver out-of-band, NOT in the repo)

Hand these over via a secure channel (password manager / internal secure note),
and transfer **account ownership** (Vercel, Neon, Anthropic billing, the Entra app
registration). The full list + descriptions are in **`.env.example`**; the ones
with real values:

- `AUTH_MICROSOFT_ENTRA_TENANT_ID` / `_ID_ID` / `_ID_SECRET` (from CTR IT)
- `ANTHROPIC_API_KEY` (company-billed)
- `DATABASE_URL` (Neon)
- `AUTH_SECRET` (generate fresh per deployment: `npx auth secret`)
- `BLOB_READ_WRITE_TOKEN`, `TEAMS_WEBHOOK_URL` (once provisioned)

---

## ⚠️ This repo is PUBLIC

- **Never commit secrets.** They live in `.env.local` (gitignored) locally and in
  Vercel env vars in production — never in code or commits.
- It already contains CTR division names, workflow details, and example employee
  references (`lib/examples.ts`) by the owner's decision — treat
  everything committed here as world-visible.
- **Rotate any key** that has been pasted into a chat, a ticket, or a log.
