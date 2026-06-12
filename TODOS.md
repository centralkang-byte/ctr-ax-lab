# TODOS

Two groups: **deployment prerequisites** (config needed before production) and
**deferred engineering work** (from /plan-ceo-review, 2026-06-11, HOLD SCOPE —
none block the pilot).

## Deployment prerequisites (before production)

### A. Vercel Blob store — progress photos — P1, Effort S (CC can do at deploy)
- **What:** Provision a Vercel Blob store; the integration injects `BLOB_READ_WRITE_TOKEN` into the project automatically.
- **Why:** Progress photos (the progress feature) fall back to `data/uploads/` locally, which is ephemeral on Vercel — uploaded photos would silently vanish between deploys/instances. Blob is required for them to persist in production.
- **Who:** Claude Code can do this via the Vercel CLI at deploy time (CLI already authed on this machine). **Open question:** deploy under the CTR-owned Vercel account (per STATUS.md deploy plan), not the personal account currently logged in.
- **Context:** Documented in `.env.example` (`BLOB_READ_WRITE_TOKEN`). No code change needed — `app/api/upload/route.ts` already branches on the token's presence.

### B. Teams notification webhook — P1, Effort S (CTR IT / CEO, ~5 min)
- **What:** Create a Power Automate "when a webhook request is received → post to a channel" flow in the CTR M365 tenant; put the generated URL in `TEAMS_WEBHOOK_URL`.
- **Why:** Without it, progress updates / feedback / review decisions notify no one — the feed only changes when someone opens the app. Notifications are what get the progress feature actually used.
- **Who:** Must be created inside the CTR tenant (CEO or IT) — Claude Code cannot. Steps: make.powerautomate.com → template "Post to a channel when a webhook request is received" → pick the AX channel → copy the HTTP URL → hand to CC to set the env var + send a test.
- **Context:** Documented in `.env.example` (`TEAMS_WEBHOOK_URL`). No-op when unset, so safe to ship without it and add later. Card deep-links use `AUTH_URL`.

---

## Deferred engineering work

### 1. CI build check on every push — ✅ SHIPPED (commit 024bbf6)
`.github/workflows/ci.yml` runs `npm ci → npm test → npm run build` on Node 24
for every push/PR to main. No secrets (`next build` is env-free). First run green.

### 2. Localize API error messages to Korean — P3, Effort M
- **What:** Audit API route error strings (English-only upstream) and serve bilingual messages per `Locale`.
- **Why:** Korean-first user base; current errors surface in English.
- **Pros:** Less confusion for non-engineer employees when something fails.
- **Cons:** Strings are scattered across routes (i18n dictionary is vestigial upstream); touches many files for modest value.
- **Context:** Do only if pilot users actually complain.

### 3. Admin-configurable quadrant threshold — ✅ SHIPPED (commit 179be5c)
Admin slider [2.5–4.5] for the priority-map "high" boundary, mirroring the
submit-threshold pattern. The live boundary is threaded through every quadrant
display (map + popup, admin history list/panel, proposal detail, brainstorm
history + star-map, /projects rows) via `quadrantLabelForGroups()`, so no two
surfaces show the same proposal as different quadrants. CI green.

### 4. Per-user rate limiting & LLM usage logging — ✅ SHIPPED (commit 0854416)
`lib/llm-usage.ts` store (Neon `llm_usage` / `data/llm-usage.json` fallback) +
hourly per-user caps, env-overridable (`RATE_LIMIT_DETAIL_PER_HOUR`=40,
`RATE_LIMIT_SCORE_PER_HOUR`=20 → HTTP 429 over the cap) on /api/detail +
/api/evaluations/[id]/score, logging who/when/route/model. Fail-open on store
errors. Admin usage view deferred (logging only, by CEO call). CI green.
- **Follow-up (optional):** an admin usage tab over `llm_usage`; token capture
  (currently reserved/null — needs usage_metadata plumbed through the graph).

### 5. Proposal- & progress-data retention & deletion policy — P2, Effort S (policy work, not code)
- **What:** Decide retention period, deletion rights, and classification guidance for the business-sensitive data the app stores in Neon (and define who owns audit answers for it).
- **Why:** Outside-voice finding #6 — the app creates a new permanent store of sensitive content; the login-page notice (decision D9) covers behavior, not governance. The progress feature **widened this surface**: it now also stores execution notes and **uploaded photos** (which may contain screenshots of internal systems, financials, or PII) in Neon + Vercel Blob.
- **Context:** CTR's existing company-wide Claude policy covers the LLM processing side; this TODO is about the database + blob side. Revisit before expanding past the pilot group, and before any external due-diligence review.
