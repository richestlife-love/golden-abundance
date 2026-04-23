# Phase 7 — Launch Runbook

Operator-facing checklist for the dashboard/infra work that Phase 7's code commits can't do for you. Every step points back to the plans that own the detail; this page exists to keep the ordering + paste-able commands in one place during launch day.

**Prereqs already shipped in code** (on `main` at tag `phase-7`): backend `Dockerfile` + `.dockerignore`, `sentry-sdk[fastapi]` + init in `create_app`, `sentry_sdk.set_user` in `current_user`, `@sentry/react` + `ErrorBoundary` in `main.tsx`, `@sentry/vite-plugin` hidden-mode source maps, GitHub Actions CI workflow.

**Plans (source of truth):**
- [Phase 7a — deploy foundation](superpowers/plans/2026-04-21-phase-7a-deploy-foundation.md)
- [Phase 7b — observability + launch polish](superpowers/plans/2026-04-21-phase-7b-observability-launch.md)
- [Design spec §6–§7](superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md)

**Rollback posture**: Railway "Redeploy prior build" + Vercel "Promote to Production" are both one-click; DNS TTL stays at 300s through launch week so a DNS swap propagates in < 5 min. See design spec §10.

---

## Phase 7a — deploy foundation

Sequence matters: Google Cloud → Supabase role → Railway → Vercel → DNS → Supabase redirects → smoke. The Railway + Vercel projects can be created in parallel once the role + OAuth are ready.

### 1. Google Cloud OAuth (plan 7a §0)

https://console.cloud.google.com/ → new project `goldenabundance-prod`.

**APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID:**
- Application type: Web application
- Name: `goldenabundance.app web`
- Authorized JavaScript origins: `https://goldenabundance.app`, `http://localhost:5173`
- Authorized redirect URIs: `https://<supabase-ref>.supabase.co/auth/v1/callback`

Copy Client ID + Secret → paste into Supabase → Authentication → Providers → Google → Save.

**OAuth consent screen:**
- User Type: External
- App name: `金富有志工`
- Application home page: `https://goldenabundance.app`
- Authorized domains: `goldenabundance.app`
- Scopes: defaults only (`openid`, `email`, `profile`)
- Publishing status: In production

### 2. Supabase `app_runtime` Postgres role (plan 7a §B)

Supabase → SQL Editor → new query. Paste the `CREATE ROLE app_runtime WITH LOGIN BYPASSRLS NOINHERIT PASSWORD '<strong-random-password>';` block from plan 7a §B Task B1 Step 2 (grants + default privileges included). Generate a 24+ char password; do not commit it.

Compose the DATABASE_URL (app runtime):

```
postgresql+psycopg://app_runtime:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require
```

Compose the MIGRATION_DATABASE_URL (Alembic only — needs DDL privileges the restricted role doesn't have, so point this at the built-in `postgres` superuser):

```
postgresql+psycopg://postgres:<postgres-pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require
```

The `postgres` password is the one you set when creating the Supabase project (Settings → Database → Reset database password if lost). Alembic reads `MIGRATION_DATABASE_URL` when set and falls back to `DATABASE_URL` otherwise — see `backend/src/backend/config.py` and `backend/alembic/env.py`.

Test both from your laptop with the `get_engine` snippet in plan 7a §B Task B1 Step 5 — expect `connected as: app_runtime` for `DATABASE_URL` and `connected as: postgres` for `MIGRATION_DATABASE_URL`.

### 3. Railway backend project (plan 7a §C1)

https://railway.app/new → Deploy from GitHub repo → this repo. Settings:
- Root directory: `backend`
- Builder: Dockerfile (auto-detected)
- **Pre-Deploy Command**: `alembic upgrade head` — runs in an ephemeral container before the new app container starts; a failed migration aborts the deploy and traffic stays on the previous version. Reads `MIGRATION_DATABASE_URL` (superuser) from the service env.
- Healthcheck path: `/readyz` (pings the DB pool), timeout 30s. `/health` stays as a pure liveness probe. Bump to 60s if first-connect to Supabase is consistently slow.

Environment variables:

| Var | Value |
|---|---|
| `DATABASE_URL` | app-runtime URL from step 2 |
| `MIGRATION_DATABASE_URL` | postgres-superuser URL from step 2 (Alembic only) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_JWT_AUD` | `authenticated` |
| `APP_ENV` | `prod` |
| `CORS_ORIGINS` | `https://goldenabundance.app` |
| `APP_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}` (literal — Railway substitutes at deploy time) |
| `RATE_LIMIT_DISABLED` | **unset / `0`** — must be enabled in prod (CI sets it to `1` to avoid flapping idempotent-loop tests) |

Deploy. Watch the Pre-Deploy log for `alembic upgrade head` (INFO lines for each revision applied) → then the Deploy log for `Uvicorn running` → healthcheck green. Verify both probes:

```bash
curl https://<service>.up.railway.app/health   # {"status":"ok"}      — process up
curl https://<service>.up.railway.app/readyz   # {"status":"ready"}   — DB reachable
```

Settings → Networking → Custom Domains → add `api.goldenabundance.app`; record the target CNAME.

### 4. Prod seed reference data (plan 7a §C2)

**Only after Railway has booted once** so migrations created the tables. From your laptop:

```bash
DATABASE_URL='postgresql+psycopg://app_runtime:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require' \
APP_ENV=prod \
SUPABASE_URL='https://<ref>.supabase.co' \
  uv run --project backend python -c "
import asyncio
from backend.db.engine import get_session_maker
from backend.seed import _upsert_news, _upsert_task_defs

async def main():
    async with get_session_maker()() as session:
        await _upsert_task_defs(session)
        await _upsert_news(session)
        await session.commit()
    print('prod seed: task_defs + news_items done')

asyncio.run(main())
"
```

Verify in Supabase SQL editor: `SELECT display_id FROM task_defs;` expects T1–T4; `SELECT title FROM news_items;` expects ≥ 3 rows.

### 5. Vercel frontend project (plan 7a §D)

https://vercel.com/new → import repo. Settings:
- Framework preset: Vite
- Root directory: `frontend`
- Build command: `pnpm install --frozen-lockfile && VITE_RELEASE="$VERCEL_GIT_COMMIT_SHA" pnpm build`
- Output directory: `dist`
- Node version: 22.x

Environment variables (Production + Preview):

| Var | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key from Supabase → Settings → API (format `sb_publishable_...`) |

`VITE_RELEASE` is set via the build command above — do **not** add it to the env-var UI (the literal `${…}` would be baked into the bundle).

Deploy. Verify CSP headers on the generated `.vercel.app` URL:

```bash
curl -sI https://<your-project>.vercel.app \
  | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy'
```

Settings → Domains → add `goldenabundance.app`.

### 6. DNS (plan 7a §E)

At the registrar:
- Apex `goldenabundance.app`: `A` → `76.76.21.21` (verify in Vercel — IPs change) **or** CNAME-flatten / ALIAS → `cname.vercel-dns.com` if registrar supports it
- `api.goldenabundance.app`: `CNAME` → Railway target from step 3
- TTL: **300s** through launch week; raise to 3600s after stability

Verify:

```bash
dig +short goldenabundance.app @1.1.1.1
dig +short api.goldenabundance.app @1.1.1.1
curl -sI https://goldenabundance.app | head -3
curl -sI https://api.goldenabundance.app/health | head -3
```

Let's Encrypt takes ~5 min after DNS propagates.

### 7. Supabase redirect URLs (plan 7a §F)

Supabase → Authentication → URL Configuration:
- **Site URL**: `https://goldenabundance.app`
- **Additional redirect URLs** (one per line):
  - `https://goldenabundance.app/auth/callback`
  - `http://localhost:5173/auth/callback`
  - `https://*.vercel.app/auth/callback` (PR previews — tighten post-launch to `https://<your-vercel-project-slug>-*.vercel.app/auth/callback`; find the slug in Vercel → your project → Deployments → a preview URL's prefix before the first hash)

### 8. Prod smoke (plan 7a §G)

Incognito window against `https://goldenabundance.app`:
1. Sign in with a fresh Google account → `/welcome` → complete profile → `/home`
2. Submit T1 → 50 points in `/rewards`
3. Second Google account → join-request the first account's team → approve from first → reflects on both sides

CLI smoke:

```bash
# CORS should reject evil origins
curl -sI -H 'Origin: https://evil.example' https://api.goldenabundance.app/api/v1/me \
  | grep -i 'access-control-allow-origin' || echo 'CORS rejected ✓'

# Unauth /me should 401 (not 405 — use GET, not HEAD)
curl -s -o /dev/null -w '%{http_code}\n' https://api.goldenabundance.app/api/v1/me   # → 401
```

securityheaders.com grade ≥ A at https://securityheaders.com/?q=https%3A%2F%2Fgoldenabundance.app

---

## Phase 7b — observability + launch polish

### 9. Sentry backend (plan 7b §A3)

https://sentry.io/ → new project → FastAPI. Copy DSN. Railway → your backend service → Variables → add `SENTRY_DSN`. Verify `APP_RELEASE` is still set from step 3.

Redeploy. Smoke:
1. Add a throwaway endpoint in `backend/src/backend/routers/health.py`:
   ```python
   @router.get("/debug/sentry-smoke")
   def sentry_smoke() -> None:
       raise RuntimeError("sentry smoke test — Phase 7b")
   ```
2. Commit + push; wait for Railway deploy.
3. `curl https://api.goldenabundance.app/debug/sentry-smoke` → 500.
4. Check Sentry → Issues: expect `RuntimeError: sentry smoke test — Phase 7b` with commit-SHA release tag + `environment=prod`.
5. `git revert HEAD && git push`. Confirm `/debug/sentry-smoke` now 404s.

### 10. Sentry frontend (plan 7b §B4)

https://sentry.io/ → new project → React. Copy DSN.

Sentry → Settings → Account → API → Auth Tokens → create token with scopes `project:releases` + `org:read`. Copy (shown once).

Vercel → Settings → Environment Variables:

| Var | Scope | Value |
|---|---|---|
| `VITE_SENTRY_DSN` | Production + Preview | frontend DSN |
| `SENTRY_AUTH_TOKEN` | Production (**Secret**) | token above |
| `SENTRY_ORG` | Production | your Sentry org slug |
| `SENTRY_PROJECT` | Production | `goldenabundance-frontend` |

Redeploy. Build logs should show `Uploaded <N> files to <SENTRY_ORG>/<SENTRY_PROJECT>`.

Smoke:
1. Add the `SentrySmokeButton` + `Bomb` component from plan 7b §B4 Step 5 (gated on `?debug=sentry`) into a screen.
2. Commit + push; wait for Vercel deploy.
3. Visit `https://goldenabundance.app/?debug=sentry` → click the button → fallback renders → Sentry issue lands within ~30s with source-mapped lines + `VITE_RELEASE` SHA.
4. `git revert HEAD && git push`. Confirm the button no longer renders.

### 11. UptimeRobot (plan 7b §C)

https://uptimerobot.com/ (free tier):
- Monitor 1: HTTP(s), `https://api.goldenabundance.app/health`, name `goldenabundance api`, 5-min interval
- Monitor 2: HTTP(s), `https://goldenabundance.app/`, name `goldenabundance web`, 5-min interval
- Alert Contact: email (or Slack webhook); attach to both monitors
- Verify via Alert Contact → "Test" (safer than pausing the Railway service)
- Optional: enable public status page at `stats.uptimerobot.com/<slug>`

### 12. GitHub branch protection (plan 7b §D3)

Settings → Branches → Branch protection rules → Add rule:
- Branch name pattern: `main`
- Require pull request before merging: **on**
- Require status checks: **on** — required: `backend`, `frontend`
- Require branches to be up to date before merging: **on**

Test by attempting a direct push to `main` — GitHub should reject.

### 13. Launch-day checklist (plan 7b §E)

Incognito, fresh personal Google account (not pre-seeded):
1. Sign-in round-trip → `/welcome` → profile → `/home`
2. Submit T1 (interest form) → +50 in `/rewards`
3. Submit T2 (ticket form) → reward ledger updates
4. Second account → join request → approve from first → reflects on both sides
5. Backend Sentry smoke (if not already in step 9)
6. Frontend Sentry smoke (if not already in step 10)
7. UptimeRobot: both monitors green ≥ 30 min
8. Security headers grade ≥ A (`securityheaders.com`); count 6 (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy + Vercel-added HSTS)
9. CORS smoke (from step 8)
10. Unauth `/me` → 401 (from step 8)
11. Sign out on `goldenabundance.app` → `/sign-in`; direct URL `https://goldenabundance.app/me` bounces to `/sign-in?returnTo=%2Fme`
12. DNS from fresh resolver (from step 6)
13. Supabase rate limits — default 60 sign-ups/hr; file a support ticket for a temp bump if expecting a launch-day spike above that

### 14. Supabase rate-limit review (plan 7b §E Step 13)

Dashboard → Authentication → Rate Limits. Default 60 sign-ups/hr may not cover launch day.

---

## Post-launch follow-ups

Not part of Phase 7; lives in design spec §11:
- Admin publish workflow for news
- GDPR delete / account-removal endpoint
- Custom Supabase Auth domain (removes the `<ref>.supabase.co` hop in OAuth URLs)
- Row-level security if Supabase Realtime is ever wired in
- Playwright for the full sign-in → submit → approve flow
- Sentry Replay + Profiling (currently off for MVP)
