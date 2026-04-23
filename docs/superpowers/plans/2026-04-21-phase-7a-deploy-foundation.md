# Phase 7a — Deploy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase-5 backend + Phase-6 frontend to the public internet at `goldenabundance.app` + `api.goldenabundance.app`. Backend runs on Railway as a Dockerized FastAPI. Frontend runs on Vercel as a static SPA. Database is managed Supabase Postgres. A signed-in real user can reach the public URL, authenticate via Google, and exercise every endpoint end-to-end.

**Prereqs:** Plans 6a and 6b merged on `main`. The Supabase project created in plan 6a §0 is ready. A domain registrar account with `goldenabundance.app` purchased (or at minimum unpurchased but available).

**Pre-flight verification** (one minute — confirms 6a + 6b actually landed on `main` before you start clicking in dashboards):

```bash
# All four paths must exist. If any is missing, 6a/6b is incomplete — stop and go finish it.
ls backend/src/backend/auth/supabase.py        # from 6a: JWKS verifier
ls frontend/src/lib/supabase.ts                # from 6b: Supabase client singleton
ls frontend/src/routes/auth.callback.tsx       # from 6b: OAuth callback handler (exact filename may be auth_.callback.tsx or auth/callback.tsx depending on TanStack Router convention)
ls frontend/vercel.json                        # from 6b: CSP + SPA rewrite

# Also confirm the legacy stub is gone (belt-and-suspenders against a half-merged 6a).
! ls backend/src/backend/auth/jwt.py 2>/dev/null && echo '6a cleanup ok'
```

**Architecture:** No application code changes — this plan is pure infrastructure and config. Outbound Alembic migrations run on backend container startup. DNS records point `goldenabundance.app` → Vercel, `api.goldenabundance.app` → Railway. CORS is locked to the production origin. Secrets live in Railway's + Vercel's UIs; the existing `.env.example` files document the shape.

**Tech Stack:** Vercel, Railway, Supabase (Postgres + Auth), Google Cloud Console (OAuth 2.0 credentials), Docker, Python 3.14-slim base image, uv.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §6 (Sub-plan 7a).

**Exit criteria:**
- `https://goldenabundance.app` resolves and serves the Vercel-built frontend.
- `https://api.goldenabundance.app/health` returns 200.
- Google sign-in end-to-end on prod: Google consent → Supabase callback → `goldenabundance.app/auth/callback` → `/welcome` (or `/home` if profile complete).
- `alembic upgrade head` has run against the prod Supabase Postgres and created all 11 tables.
- `securityheaders.com` grade for `goldenabundance.app`: A or better.
- `curl -H "Origin: https://evil.example" https://api.goldenabundance.app/api/v1/me` returns no `Access-Control-Allow-Origin` header.

---

## Section 0 — Manual one-time Google Cloud setup

Plan 6a §0 covers **Supabase project** setup (project creation, JWT signing keys, URL allowlist). This section covers the **Google Cloud OAuth** credentials that Supabase's Google provider consumes — a different prereq, not covered by 6a. Skip only if you already configured Google Cloud OAuth credentials for this Supabase project.

- [ ] **Step 1: Create or reuse a GCP project**

https://console.cloud.google.com/ → create project (e.g., `goldenabundance-prod`).

- [ ] **Step 2: Create OAuth 2.0 credentials**

APIs & Services → Credentials → **Create Credentials → OAuth 2.0 Client ID**.

- Application type: **Web application**
- Name: `goldenabundance.app web`
- Authorized JavaScript origins:
  - `https://goldenabundance.app`
  - `http://localhost:5173`
- Authorized redirect URIs:
  - `https://<supabase-ref>.supabase.co/auth/v1/callback`

Copy the generated Client ID + Client Secret.

- [ ] **Step 3: Paste into Supabase**

Supabase dashboard → Authentication → Providers → Google → paste Client ID + Secret → Save.

- [ ] **Step 4: Consent screen configuration**

APIs & Services → OAuth consent screen:
- User Type: External (so any Google account can sign in)
- App name: `金富有志工`
- User support email: your email
- App logo: optional for MVP
- Application home page: `https://goldenabundance.app`
- Authorized domains: `goldenabundance.app`
- Developer contact: your email
- Scopes: only the defaults (`openid`, `email`, `profile`). No sensitive or restricted scopes.
- Publishing status: **In production** (so sign-ins don't throw a "not verified" warning beyond the initial 100-user cap; request verification later if you expect >100 distinct Google accounts to sign in).

---

## Section A — Backend Dockerfile + pyproject tweaks

**Exit criteria:** `docker build -t jfy-backend -f backend/Dockerfile backend/` succeeds and produces an image that runs `alembic upgrade head && uvicorn ...` on start.

### Task A1: Write the Dockerfile

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create `backend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

# -------- build stage --------
FROM python:3.14-slim AS build

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir uv==0.11.7

WORKDIR /app

# Copy manifests first for layer caching: a source-only change doesn't bust the deps layer.
COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

# Now copy the project + sync again to install the project itself.
COPY . .
RUN uv sync --frozen --no-dev

# -------- runtime stage --------
FROM python:3.14-slim AS runtime

# libpq for psycopg (binary wheel bundles libpq but not the shared system dep on slim).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Non-root user — Railway doesn't require it but it's cheap hygiene.
RUN useradd --create-home --uid 1000 app
USER app

COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Alembic runs migrations idempotently on every container start. If the migration
# fails, the container exits non-zero → Railway keeps the previous deployment live.
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.server:app --host 0.0.0.0 --port ${PORT}"]
```

Note on the `uv==0.11.7` pin: if that exact patch isn't on PyPI when you build, drop the pin to `uv==0.11.*` or the latest 0.11 patch. Do not leave `uv` unpinned — it silently picks up majors and breaks reproducibility.

- [ ] **Step 2: Create `backend/.dockerignore`**

```
# Never copy these into the image
.git
.github
.ruff_cache
.pytest_cache
__pycache__
.venv
dist
build
*.egg-info
.env
.env.local
.env.*.local
*.log
tests
docker-compose.yml
Dockerfile
.dockerignore
```

Note: `tests/` excluded — production image doesn't need them. `.env` excluded — secrets come from Railway env vars.

- [ ] **Step 3: Build locally to verify the Dockerfile syntax and deps resolve**

```bash
docker build -t jfy-backend -f backend/Dockerfile backend/
```

Expected: successful build, no layer errors. Should take 30-90s depending on cache state.

- [ ] **Step 4: Smoke the image against your local docker-compose Postgres**

```bash
# Start local Postgres
just -f backend/justfile db-up

# Run the image, reusing host networking so it can reach localhost:5432
docker run --rm -p 8001:8000 \
  -e DATABASE_URL="postgresql+psycopg://app:app@host.docker.internal:5432/app" \
  -e SUPABASE_URL="https://test-ref.supabase.co" \
  -e APP_ENV="dev" \
  -e CORS_ORIGINS="http://localhost:5173" \
  jfy-backend
```

`APP_ENV="dev"` is deliberate even though we're running the prod image — 6a adds a prod-env validator that rejects localhost/test Supabase URLs when `APP_ENV=prod`. The smoke test only exercises the container's boot path (alembic + uvicorn), not prod-auth semantics, so `dev` bypasses the validator.

(On Linux, replace `host.docker.internal` with `172.17.0.1` or pass `--network host` + adjust port.)

In a second terminal:

```bash
curl -s http://localhost:8001/health | jq
```

Expected: `{"status":"ok"}`.

Ctrl-C the container.

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(backend): multi-stage Dockerfile with Alembic pre-start (Phase 7a)"
```

---

## Section B — Supabase Postgres role for backend

**Exit criteria:** `app_backend` role exists in the prod Supabase Postgres with `BYPASSRLS` + `public` schema grants, and a DATABASE_URL using this role successfully connects.

### Task B1: Create the `app_backend` role via Supabase SQL editor

**Files:** (Supabase dashboard — no files touched here)

- [ ] **Step 1: Open Supabase SQL editor**

Supabase dashboard → your project → SQL Editor → New query.

- [ ] **Step 2: Run the role-setup SQL**

```sql
-- Create the app-scoped role used by FastAPI.
-- Replace <strong-random-password> with a 24+ char generated password.
-- DO NOT commit the password; paste it into Railway's env var UI directly.

CREATE ROLE app_backend WITH
  LOGIN
  BYPASSRLS
  NOINHERIT
  PASSWORD '<strong-random-password>';

-- Grants on the public schema (where our Alembic migrations land).
GRANT USAGE ON SCHEMA public TO app_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_backend;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_backend;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_backend;

-- Future-proof: default privileges on new tables/sequences/functions.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_backend;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_backend;
```

Run. Expected: no errors.

- [ ] **Step 3: Verify the role**

In the SQL editor:

```sql
SELECT rolname, rolbypassrls, rolcanlogin
FROM pg_roles
WHERE rolname = 'app_backend';
```

Expected: one row with `rolbypassrls=true`, `rolcanlogin=true`.

- [ ] **Step 4: Compose the DATABASE_URL**

Supabase → Settings → Database → Connection string → "URI". It looks like `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres`.

Replace `postgres:<pw>` with `app_backend:<pw>` (the password from Step 2). Prepend `postgresql+psycopg://` so SQLAlchemy uses psycopg3. Append `?sslmode=require`.

Final form (save somewhere; paste into Railway in Section C):

```
postgresql+psycopg://app_backend:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require
```

- [ ] **Step 5: Test the URL from your local machine**

```bash
DATABASE_URL='postgresql+psycopg://app_backend:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require' \
  uv run --project backend python -c "
from backend.db.engine import get_engine
import asyncio
async def main():
    eng = get_engine()
    async with eng.connect() as conn:
        from sqlalchemy import text
        r = await conn.execute(text('SELECT current_user'))
        print('connected as:', r.scalar())
asyncio.run(main())
"
```

Expected output: `connected as: app_backend`.

If connection fails with "role does not exist" or "password authentication failed", revisit Step 2.

---

## Section C — Railway project (backend)

**Exit criteria:** `https://api.goldenabundance.app/health` returns 200 from a Railway-served container; logs show `alembic upgrade head` completed.

### Task C1: Create the Railway project

**Files:** (Railway dashboard — no files touched here)

- [ ] **Step 1: Create Railway project**

https://railway.app/new → "Deploy from GitHub repo" → pick this repo → confirm.

- [ ] **Step 2: Configure build + deploy**

Project → your new service → Settings:

- **Root directory:** `backend`
- **Builder:** Dockerfile (auto-detected from `backend/Dockerfile`)
- **Build command:** (leave empty — Dockerfile owns it)
- **Start command:** (leave empty — Dockerfile CMD owns it)
- **Healthcheck path:** `/health`
- **Healthcheck timeout:** 60s
- **Restart policy:** On failure

If the first deploy cycles repeatedly with healthcheck failures, Alembic is likely still running when the timeout fires. Temporarily raise **Healthcheck Timeout** to 180s, let the fresh migration finish once, then drop back to 60s for subsequent deploys (where migrations are a no-op).

- [ ] **Step 3: Configure environment variables**

Project → Variables → add each row:

| Var | Value |
|---|---|
| `DATABASE_URL` | the full `postgresql+psycopg://app_backend:...` string from Task B1 Step 4 |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_JWT_AUD` | `authenticated` |
| `APP_ENV` | `prod` |
| `CORS_ORIGINS` | `https://goldenabundance.app` |
| `APP_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}` (literal — Railway substitutes it at deploy time) |

*Do not* set `SENTRY_DSN` yet; that belongs in plan 7b.

- [ ] **Step 4: Trigger a deploy**

Railway auto-deploys on push to `main` once the GitHub integration is linked. Either push a no-op commit or click "Deploy now" in the Railway UI.

Watch the build logs. Expected progression:
1. "Building Docker image" (~30–90s)
2. "Starting container"
3. Migration output: `INFO [alembic.runtime.migration] Running upgrade -> 0001_initial`
4. `INFO:     Uvicorn running on http://0.0.0.0:8000`
5. Healthcheck passes (`GET /health` → 200)

Failure modes:
- Build fails on `uv sync`: check `backend/uv.lock` is committed and `pyproject.toml` is parseable.
- Migration fails: likely `DATABASE_URL` wrong. Connect locally (Task B1 Step 5) to diagnose.
- Container starts but healthcheck times out: exposed port mismatch — confirm Railway's `PORT` env injection wires to `uvicorn --port ${PORT}`.

- [ ] **Step 5: Verify via Railway's generated `.up.railway.app` URL**

```bash
curl -s https://<your-service>.up.railway.app/health | jq
```

Expected: `{"status":"ok"}`.

- [ ] **Step 6: Assign custom domain `api.goldenabundance.app`**

Settings → Networking → Custom Domains → Add `api.goldenabundance.app`. Railway will show a target CNAME value (e.g., `<project>.up.railway.app`). Record it — you'll point DNS at it in Section E.

(SSL cert auto-provisions via Let's Encrypt within ~2 minutes after DNS propagates.)

### Task C2: Seed prod reference data (`task_defs` + `news_items`)

**Exit criteria:** `task_defs` has rows for T1–T4 and `news_items` has ≥ 3 rows in the prod Supabase DB. Without this, the smoke test in §G Step 2 (submit T1) will fail with a "task def not found" error.

**Why a separate step:** `alembic upgrade head` creates the schema only — it does not populate rows. `backend/src/backend/seed.py::run()` seeds *everything* including the six `@demo.ga` demo users and their join-requests. In prod we want only `task_defs` + `news_items`; seeding demo users would create six orphan `UserRow`s whose IDs don't correspond to any `auth.users.id` in Supabase (they could never sign in). So we invoke the internal seed helpers directly.

- [ ] **Step 1: From your laptop, run the prod-safe seed**

```bash
DATABASE_URL='postgresql+psycopg://app_backend:<pw>@db.<ref>.supabase.co:5432/postgres?sslmode=require' \
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

Expected stdout: `prod seed: task_defs + news_items done`.

The helpers are idempotent (skip-on-existing by `display_id` / `title`), so re-running is safe — useful if you add a T5 later by editing `seed.py` and re-running this one-liner.

- [ ] **Step 2: Verify row counts in the Supabase SQL editor**

```sql
SELECT display_id, title FROM task_defs ORDER BY display_id;
SELECT title, pinned FROM news_items ORDER BY published_at DESC;
```

Expected: 4 task_def rows (T1, T2, T3, T4) and 3 news_item rows.

---

## Section D — Vercel project (frontend)

**Exit criteria:** `https://goldenabundance.app` serves the Vite-built SPA; CSP headers from `vercel.json` are present on every response.

### Task D1: Create the Vercel project

**Files:** (Vercel dashboard — no files touched here)

- [ ] **Step 1: Import the repo**

https://vercel.com/new → "Import Git Repository" → pick this repo.

- [ ] **Step 2: Configure project**

- **Framework preset:** Vite
- **Root directory:** `frontend`
- **Build command:** `pnpm install --frozen-lockfile && VITE_RELEASE="$VERCEL_GIT_COMMIT_SHA" pnpm build`
- **Output directory:** `dist`
- **Install command:** (leave default — Vercel uses pnpm when it sees pnpm-lock.yaml)
- **Node version:** 22.x (match `frontend/package.json` engines.node)

The build command injects `VITE_RELEASE` from Vercel's system env var `VERCEL_GIT_COMMIT_SHA` at build time (Vite only reads `VITE_*`-prefixed vars into `import.meta.env`, and Vercel does **not** expand `${…}` or `${{…}}` inside env-var *values*). Do not set `VITE_RELEASE` in the env-var UI — the literal would be baked into the bundle.

- [ ] **Step 3: Configure environment variables**

Vercel → Settings → Environment Variables → add for both Production and Preview:

| Var | Production | Preview |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | same |
| `VITE_SUPABASE_ANON_KEY` | (anon JWT from Supabase Settings → API) | same |

`VITE_RELEASE` is **not** set here — it's injected via the build command above (see Step 2). `VERCEL_GIT_COMMIT_SHA` is always present as a Vercel system env var, so no user action is required.

Do not set `VITE_SENTRY_DSN` or `SENTRY_AUTH_TOKEN` yet; those come in plan 7b.

- [ ] **Step 4: Trigger a deploy**

Vercel auto-deploys on push to `main`. Or click Deploy. Expected build output:

```
vite v8.x building for production...
✓ <N> modules transformed.
dist/index.html ...
dist/assets/index-<hash>.js ...
Build completed in <N>ms.
```

- [ ] **Step 5: Verify the generated `.vercel.app` URL**

Click the preview URL Vercel shows. Sign-in will fail until DNS + Supabase redirects point at prod (Section E) — but the page should load and the browser should render the landing screen.

- [ ] **Step 6: Verify CSP headers**

```bash
curl -sI https://<your-project>.vercel.app | grep -i -E 'content-security-policy|x-frame-options|referrer-policy|permissions-policy|x-content-type-options'
```

Expected: all five headers from `frontend/vercel.json` present.

- [ ] **Step 7: Assign custom domain `goldenabundance.app`**

Settings → Domains → Add `goldenabundance.app` (apex). Vercel shows the `A` / `CNAME` values needed for DNS. Record them — Section E wires DNS.

(Also add `www.goldenabundance.app` with a 301 → apex redirect if you want the `www` prefix to work too; optional.)

---

## Section E — DNS

**Exit criteria:** `dig goldenabundance.app` and `dig api.goldenabundance.app` both resolve to Vercel and Railway respectively; browsers reach both over HTTPS.

### Task E1: Configure DNS records at the registrar

**Files:** (Registrar dashboard — no files touched here)

- [ ] **Step 1: Log in to the registrar** where you bought `goldenabundance.app` (Namecheap / Cloudflare / Porkbun / etc.).

- [ ] **Step 2: Set the apex record for Vercel**

Vercel's apex instructions (as of 2026) give one of:
- `A` record → `76.76.21.21` (current Vercel anycast IP — confirm in Vercel's domain UI, values change)
- OR CNAME flattening / ALIAS / ANAME record → `cname.vercel-dns.com` (only works on some registrars — Cloudflare, Porkbun support this; Namecheap doesn't).

Use whichever your registrar supports. Prefer CNAME-flattening if available — faster propagation on IP changes.

TTL: **300s** for launch week (fast rollback). Raise to 3600s after launch stabilizes.

- [ ] **Step 3: Set the `api` CNAME for Railway**

Add a `CNAME` record:
- Host: `api`
- Value: the Railway target CNAME from Section C Task C1 Step 6 (e.g., `<project>.up.railway.app`)
- TTL: 300s

- [ ] **Step 4: (Optional) Set `www` redirect**

If you want `www.goldenabundance.app` to resolve:
- Add `CNAME www → cname.vercel-dns.com` (or the same flattening target as apex)
- In Vercel, add `www.goldenabundance.app` and configure it as a 301 redirect to apex.

- [ ] **Step 5: Wait for propagation + verify**

```bash
# Should resolve to Vercel IPs
dig goldenabundance.app +short
# Should resolve to Railway's CNAME target
dig api.goldenabundance.app +short
# Confirm SSL cert
curl -sI https://goldenabundance.app | head -5
curl -sI https://api.goldenabundance.app/health | head -5
```

Expected: both URLs serve 200 OK over HTTPS.

Troubleshooting:
- Apex not resolving: some registrars silently reject `A` records if a `CNAME` is already set at apex; remove the CNAME.
- `api` times out: Railway custom domain needs explicit add in Settings → Networking (Section C Task C1 Step 6).
- SSL handshake fails: Let's Encrypt cert issuance waits for DNS propagation; give it 5 minutes after DNS resolves.

---

## Section F — Supabase Auth redirect URLs for prod

**Exit criteria:** Signing in on `goldenabundance.app` redirects to `goldenabundance.app/auth/callback` (not localhost or preview URL).

### Task F1: Update Supabase URL allowlist

**Files:** (Supabase dashboard — no files touched here)

- [ ] **Step 1: Supabase → Authentication → URL Configuration**

- **Site URL:** `https://goldenabundance.app` (this is the default redirect Supabase uses when OAuth doesn't specify one)
- **Additional redirect URLs** (one per line):
  - `https://goldenabundance.app/auth/callback`
  - `http://localhost:5173/auth/callback` (local dev)
  - `https://*.vercel.app/auth/callback` (Vercel PR previews)

Save. Changes propagate instantly.

Note: `https://*.vercel.app/auth/callback` is intentionally broad for MVP so any PR preview works without per-preview allowlist edits. It is also broader than needed — in principle another Vercel project could craft a redirect back through our Supabase. The practical mitigation is Google Cloud's redirect-URI pinning (locked to `https://<ref>.supabase.co/auth/v1/callback` — see §0 Step 2), which is unaffected by this list. Post-launch, tighten to `https://jfy-web-*.vercel.app/auth/callback` (or whatever Vercel prefixes your project's previews with) and re-check that PR preview sign-in still works.

- [ ] **Step 2: Verify from a new incognito window**

1. https://goldenabundance.app
2. Click "Sign in with Google"
3. Pick a Google account
4. Browser returns to `https://goldenabundance.app/auth/callback` → `/welcome` (if first sign-in) or `/home`
5. Sign out → back at `/sign-in`
6. `GET /api/v1/me` with no auth → 401

---

## Section G — Prod smoke test + sign-off

**Exit criteria:** Launch checklist items under §7.5 of the design spec run green (except Sentry items, which plan 7b adds).

### Task G1: Run the launch-partial smoke

- [ ] **Step 1: Sign-in end-to-end**

In an incognito window against `https://goldenabundance.app`, sign in with your Google account → `/welcome` (profile incomplete for a fresh account). Complete the profile. Land on `/home`.

- [ ] **Step 2: Task flow**

Submit T1 (interest form). Confirm the success overlay fires and 50 points show up in `/rewards`.

- [ ] **Step 3: Team flow**

From a second Google account in another incognito window, sign in → complete profile (creates a led team automatically). Send a join request to the first account's led team. From account 1, approve the request. Confirm the approval reflects on both sides.

- [ ] **Step 4: CORS smoke**

```bash
curl -sI -H 'Origin: https://evil.example' \
  https://api.goldenabundance.app/api/v1/me | grep -i 'access-control-allow-origin' || echo 'CORS rejected ✓'
```

Expected: `CORS rejected ✓` (no `Access-Control-Allow-Origin` header returned).

- [ ] **Step 5: Auth smoke**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.goldenabundance.app/api/v1/me
```

Expected: `401`.

Do **not** use `curl -I` / `-X HEAD` here — FastAPI's router only registers GET for `/me`, so HEAD would return 405 (misleading) instead of the 401 we're testing for.

- [ ] **Step 6: Security headers smoke**

Browse to https://securityheaders.com/?q=https%3A%2F%2Fgoldenabundance.app → score should be **A** or better. If not, revisit `frontend/vercel.json` header set.

- [ ] **Step 7: Supabase rate-limit review**

Supabase dashboard → Authentication → Rate Limits — note the 60 sign-ups/hour default. If a launch-day spike above that is expected, open a Supabase support ticket now (before launch) requesting a bump.

- [ ] **Step 8: Post-smoke commit**

No code changes required from G1. If you ran into any fixup (e.g., a CORS config tweak, a missing env var), commit each fix as its own atomic change:

```bash
git add <files>
git commit -m "fix(deploy): <what> (Phase 7a)"
```

---

## Final self-check before handoff to 7b

- [ ] `https://goldenabundance.app` loads; `https://api.goldenabundance.app/health` returns 200.
- [ ] Google OAuth round-trip works end-to-end.
- [ ] Prod Supabase Postgres has all 11 tables (check via Supabase Table Editor).
- [ ] Railway auto-deploys on `main`; Vercel auto-deploys on `main` + PRs.
- [ ] DNS resolves from a fresh external resolver (`dig +nocmd +nocomments +nostats +short goldenabundance.app @1.1.1.1`).
- [ ] `securityheaders.com` grade ≥ A for `goldenabundance.app`.
- [ ] Custom-domain SSL certs valid.
- [ ] Rollback path understood: if any smoke step fails and a fix-forward isn't fast, see spec §10 (`docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md`) — Railway "Redeploy prior build" + Vercel "Promote to Production" against an earlier deployment are both one-click; DNS TTL is held at 300s so a DNS swap propagates in < 5 min.

Once this plan is done, the app is live — but blind to errors. Plan 7b wraps Sentry + UptimeRobot + GitHub Actions CI around it.
