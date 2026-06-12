# Deploying CTR AX Lab

A runbook for standing up **CTR AX Lab** in production: **Vercel** (app) +
**Neon** (Postgres) + **Microsoft Entra ID** (sign-in), all on **CTR-owned
accounts**.

> This is an internal CTR tool, not a multi-tenant product — one deployment, one
> company. Access is restricted to the CTR Microsoft 365 tenant **and** the
> `ctr.co.kr` email domain.

---

## 0. Before you start — what's true about this app

- **Sign-in is Microsoft Entra ID ONLY** (decision D3). No Google, no magic-link,
  no password. A two-layer gate (tenant **and** email domain) **fails closed**:
  with the config missing, **nobody can sign in**. See `auth.config.ts`.
- **Schema is automatic.** The Postgres tables (`evaluations`,
  `proposal_versions`, `proposal_reviews`, `app_settings`, `app_admins`,
  `progress_updates`, `progress_comments`, `llm_usage`) are created on first use —
  there is **no migration step** to run.
- **No secrets or data are in the repo** (it is **public**). Everything sensitive
  comes from env vars; runtime data lives only in Neon (+ Vercel Blob for photos).
- **Node 24**, Next.js 15. Local dev runs on **port 3090** (`npm run dev`).
- A green **build + test runs in CI** (`.github/workflows/ci.yml`) on every push /
  PR to `main`.

---

## 1. Accounts & intake — decide / collect first

| # | What you need | CTR value | Notes |
|---|---|---|---|
| 1 | Email domain(s) allowed to sign in | `ctr.co.kr` | → `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` |
| 2 | Owner admin email | `sangwoo.kang@ctr.co.kr` | → `DEFAULT_ADMIN_EMAIL`. Permanent admin, can't be removed in the UI. Must be on a domain from #1. |
| 3 | Anthropic API key | `sk-ant-…` | Company-billed. Deliver via a **secure channel**, never the repo. |
| 4 | Production URL | e.g. `https://axlab.ctr.co.kr` (or the `*.vercel.app` URL) | Needed for the Entra redirect URI. |
| 5 | Entra app registration | from **CTR IT** | tenant id + client id + client secret (step 2) |

Put the **Vercel project, the Neon database, the Anthropic billing account, and
the Entra app registration all under CTR-owned accounts** — that keeps ownership
and billing clean.

---

## 2. Microsoft Entra ID (sign-in) — CTR IT

A **single-tenant** app registration inside the **CTR M365 tenant**.

1. Entra admin center (or Azure portal) → **App registrations → New registration**.
   - **Supported account types: this organizational directory only (single tenant).**
2. **Redirect URIs** (platform: **Web**) — add exactly:
   ```
   https://<PRODUCTION_URL>/api/auth/callback/microsoft-entra-id
   ```
   …and, for local testing before go-live:
   ```
   http://localhost:3090/api/auth/callback/microsoft-entra-id
   ```
3. **Certificates & secrets → New client secret** → copy the **Value** (not the ID).
4. Collect three things:
   - **Directory (tenant) ID** → `AUTH_MICROSOFT_ENTRA_TENANT_ID`
   - **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - **Client secret value** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`

> **Why single-tenant matters:** the app pins the OIDC issuer to the CTR tenant
> **and** re-checks the token's `tid` claim + email domain server-side
> (`lib/auth-gate.ts`). Even a misconfigured registration can't widen access
> beyond the CTR tenant + `ctr.co.kr`. The redirect URI must match the deployed
> URL **exactly** (scheme + host + path) — a mismatch is the most common sign-in
> failure (see Troubleshooting).

---

## 3. Database (Neon Postgres)

In CTR's account (or via the **Vercel Marketplace Neon integration**, which wires
the env var automatically).

1. Create one Neon project + database for CTR AX Lab.
2. Copy the **pooled** connection string (looks like
   `postgresql://…-pooler.…neon.tech/…?sslmode=require`).
3. That string becomes `DATABASE_URL`.

> If you provision Neon through Vercel's integration, it may inject the URL under
> a prefixed name (e.g. `STORAGE_DATABASE_URL`). That's fine — `lib/db.ts` accepts
> any `*_DATABASE_URL` / `*_POSTGRES_URL` holding a `postgres://` URL. Don't also
> set a conflicting `DATABASE_URL`.

No tables to create — they appear on first request. **Without a database the app
silently falls back to local JSON files under `data/`, which are ephemeral on
Vercel (lost on every redeploy/instance)** — so Neon is required in production.

---

## 4. File storage + notifications (optional but recommended)

- **`BLOB_READ_WRITE_TOKEN` (Vercel Blob)** — progress-update **photos**. Without
  it they fall back to `data/uploads/` (ephemeral on Vercel → photos vanish).
  Provision the **Vercel Blob integration**; it injects the token automatically.
- **`TEAMS_WEBHOOK_URL`** — a Power Automate *"when a webhook request is received →
  post to a channel"* flow in the **CTR tenant**. Fires on progress updates,
  feedback comments, and review decisions. **No-op when unset**, so it's safe to
  ship without it and add later. Card deep-links use `AUTH_URL`.

---

## 5. Vercel project + deploy

1. Create a Vercel project from the repo (Framework preset **Next.js**, detected
   automatically).
2. Add the environment variables from §6 to **Production** (and Preview, if used).
3. Attach the custom domain (e.g. `axlab.ctr.co.kr`) and make sure it matches the
   Entra redirect URI from step 2.
4. Deploy.

---

## 6. Environment variable checklist

The authoritative template is **`.env.example`**. ✅ = required for production.

### Auth
- [ ] ✅ `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` — `ctr.co.kr`. **Empty = nobody can log
      in.** Build-time inlined → changing it later needs a **redeploy**.
- [ ] ✅ `DEFAULT_ADMIN_EMAIL` — `sangwoo.kang@ctr.co.kr`. Always an admin.
- [ ] ✅ `AUTH_SECRET` — random string. Generate with `npx auth secret` (or
      `openssl rand -base64 32`). Unique per deployment.
- [ ] ✅ `AUTH_URL` — the production URL, e.g. `https://axlab.ctr.co.kr`.
- [ ] ✅ `AUTH_MICROSOFT_ENTRA_ID_ID` — Application (client) ID (step 2).
- [ ] ✅ `AUTH_MICROSOFT_ENTRA_ID_SECRET` — client secret value (step 2).
- [ ] ✅ `AUTH_MICROSOFT_ENTRA_TENANT_ID` — Directory (tenant) ID (step 2). Also
      re-enforced server-side.

> `DEV_LOGIN` is a **local-only** password-less login for testing before the Entra
> registration lands. It is **compiled out of production builds** (double-gated:
> `NODE_ENV !== "production"` AND `DEV_LOGIN=true`, the flag only ever set in the
> gitignored `.env.local`). Never set it in Vercel.

### Database
- [ ] ✅ `DATABASE_URL` — Neon pooled connection string (§3). Or rely on a
      Vercel-injected `*_DATABASE_URL` — don't set both.

### LLM (Anthropic)
- [ ] ✅ `ANTHROPIC_API_KEY` — the active provider is **Anthropic / Claude** (the
      model picker is curated to Anthropic only). Company-billed.

### File storage / notifications (optional — see §4)
- [ ] `BLOB_READ_WRITE_TOKEN` — Vercel Blob (progress photos).
- [ ] `TEAMS_WEBHOOK_URL` — Teams channel notifications.

### LLM defaults (optional — seeds the config before anyone opens /admin)
- [ ] `LLM_PROVIDER` — `anthropic` (default)
- [ ] `ANTHROPIC_MODEL` — `claude-sonnet-4-6` (default)
- [ ] `LLM_TEMPERATURE` — `0.3`
- [ ] `LLM_MAX_TOKENS` — `1200`

> The active provider/model and the thresholds are all changeable at **/admin**
> after launch, so these are just the starting point.

### Per-user rate limits (optional)
- [ ] `RATE_LIMIT_DETAIL_PER_HOUR` — coach calls/user/hour (default `40`).
- [ ] `RATE_LIMIT_SCORE_PER_HOUR` — scoring calls/user/hour (default `20`).

---

## 7. First run (one-time, after deploy)

1. Open the production URL → sign in with the **`DEFAULT_ADMIN_EMAIL`** account
   (real M365 SSO).
2. **/admin → LLM 모델 설정 (LLM model setup):** confirm the provider/model matches
   the key you set, then **저장 (Save)**. While here:
   - Set **제출 기준 점수 (submit gate)** to the **pilot minimum** so scores are
     informational and nothing is blocked from submission in month 1 (decision D8).
   - Adjust the **사분면 경계 점수 (quadrant boundary)** later, once real score
     distributions appear, to recalibrate the priority map.
3. **/admin → 사용자 관리 (users):** grant admin to any other leaders. Only
   `ctr.co.kr` emails can be added.

---

## 8. Verify (smoke test before handover)

- [ ] A `ctr.co.kr` M365 account signs in; an outside account is **rejected**.
- [ ] Brainstorm a quick idea → the coach responds (confirms the Anthropic key).
- [ ] Generate the one-pager, it **auto-scores**, then **submit** it (confirms DB
      writes + the submit gate at the configured threshold).
- [ ] The proposal appears in the shared history and on the **우선순위 맵 (Priority
      Map)** at its quadrant.
- [ ] `/admin` is reachable as the owner; a non-admin signed-in user does **not**
      see admin data (and is bounced from `/admin`).
- [ ] Reload after a few minutes / redeploy — saved proposals **persist** (confirms
      it's hitting Neon, not the ephemeral file fallback).

If proposals vanish on redeploy, `DATABASE_URL` isn't being picked up — the app
fell back to local files, which don't survive on Vercel. Fix the env var + redeploy.

---

## 9. Handover / ownership

- Confirm **CTR owns** the Vercel project, the Neon database, the Anthropic billing
  account, and the Entra app registration.
- Hand over the owner admin login; remove any temporary collaborator access.
- ⚠️ **The repo is PUBLIC.** Never commit secrets (they live in `.env.local`
  locally / Vercel env vars in prod). **Rotate any key that ever gets pasted into
  a chat, a ticket, or a log.**

---

## 10. Updating later

The app reads everything from env, so updates are just redeploys:

1. Push to `main` → CI runs build + tests → Vercel rebuilds.
2. Schema changes (if any) apply automatically on first use — no manual migration.
3. If you changed `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`, remember it's **build-time** —
   the redeploy is what makes it take effect.

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Everyone bounced to `/login`, even valid accounts | `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS` unset/wrong, or not redeployed after setting it; or the Entra tenant id is missing (gate fails closed) | Set the domain + all three `AUTH_MICROSOFT_ENTRA_*` vars, **redeploy**. |
| Entra error `AADSTS50011` / `redirect_uri_mismatch` | App-registration redirect URI ≠ deployed callback | Make it exactly `https://<url>/api/auth/callback/microsoft-entra-id`. |
| Signs in at Microsoft but immediately rejected by the app | Wrong tenant, or email not on an allowed domain | Confirm the registration is **single-tenant** in the CTR directory and the user is `@ctr.co.kr`. |
| LLM calls fail with "X is not set" | `ANTHROPIC_API_KEY` missing | Set it to match the selected provider, redeploy. |
| Proposals disappear after redeploy | No `DATABASE_URL` → ephemeral file fallback | Set the Neon connection string, redeploy. |
| Progress **photos** disappear after redeploy | No `BLOB_READ_WRITE_TOKEN` → `data/uploads` fallback | Provision Vercel Blob, redeploy. |
| Owner can't open `/admin` | `DEFAULT_ADMIN_EMAIL` ≠ the signed-in email exactly | Fix the env var (case/spacing), redeploy. |
| Teams notifications never arrive | `TEAMS_WEBHOOK_URL` unset or the flow is off | Create the Power Automate flow in the CTR tenant, set the URL. |
