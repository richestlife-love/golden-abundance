# Phase 6+7 — Auth (Supabase) + Deploy (Vercel / Railway / Supabase)

**Status:** Design (approved)
**Date:** 2026-04-21
**Predecessors:** [Phase 2 API contract](./2026-04-19-phase-2-api-contract-design.md), [Phase 3 routing](./2026-04-20-phase-3-routing-design.md), [Phase 4 frontend wiring](./2026-04-20-phase-4-frontend-wiring-design.md), Phase 5 (persistence + runnable backend — see `docs/production-launch-plan.md`)
**Successors (planning):** post-launch hardening (admin workflows, RLS if needed, custom Supabase Auth domain)

## 1. Goal

Replace Phase 5b's email-stub auth with real Supabase Auth + deploy Phase 5's backend and Phase 4c's frontend to production on custom domains (`goldenabundance.app` + `api.goldenabundance.app`) fronted by observability. After this phase, a real volunteer can open `goldenabundance.app`, sign in with Google, interact with the live app end-to-end, and any production error lands in Sentry within seconds.

This is the final phase of the "single-file prototype → production app" migration arc. The goal state is *running in production with real users*, not just *deployable*.

## 2. Decisions (recap from brainstorm)

| # | Decision | Choice |
|---|---|---|
| 1 | Posture | Public launch to real volunteers (not pilot, not demo) |
| 2 | Auth provider | Supabase Auth + Supabase Postgres (single vendor for identity + DB) |
| 3 | Architecture | FastAPI stays as sole authoritative API; Supabase for identity issuance + Postgres hosting only |
| 4 | JWT verification | RS256 via Supabase JWKS endpoint (not HS256 shared secret) |
| 5 | Row-Level Security | Off. FastAPI is single auth plane. Dedicated `app_backend` Postgres role with `BYPASSRLS` |
| 6 | Session storage | Frontend-owned — `@supabase/supabase-js` default (localStorage) + Bearer header + strict CSP |
| 7 | Deploy platforms | Frontend → Vercel. Backend → Railway. DB+Auth → Supabase |
| 8 | Domain | `goldenabundance.app` apex (frontend) + `api.goldenabundance.app` (backend) |
| 9 | Environments | Prod only + Vercel per-PR previews (no separate staging) |
| 10 | Observability | Sentry free tier (backend + frontend) + platform-built-in logs + UptimeRobot health checks |
| 11 | Decomposition | Four sub-plans: 6a backend auth → 6b frontend auth → 7a deploy → 7b observability + launch polish |

Two items are judgment calls called out here so future readers see they were deliberate: **RLS off** (Section 5 below — defensible because FastAPI is the single DB client; flip on if Supabase Realtime or non-FastAPI direct-DB access is ever added) and **localStorage session** (Section 6 — Supabase default, XSS-vulnerable, mitigated by strict CSP; BFF cookie pattern rejected as not-worth-the-cost for this threat model).

## 3. Architecture

### 3.1 Auth data flow (after Phase 6 completes)

```
[User taps "Sign in with Google" on goldenabundance.app]
      │
      ▼
┌──────────────────────────────┐
│ goldenabundance.app (Vercel)        │  @supabase/supabase-js →
│                              │  signInWithOAuth({ provider: 'google',
│                              │    options: { redirectTo: <origin>/auth/callback }})
└──────────────┬───────────────┘
               │ browser redirect
               ▼
┌──────────────────────────────┐
│ <ref>.supabase.co/auth/v1/*  │ ──▶ Google consent screen ──▶ (user picks)
│ (Supabase Auth service)      │ ◀── Google callback
└──────────────┬───────────────┘
               │ issues RS256 JWT {sub = auth.users.id, email, aud='authenticated', ...}
               │ redirects to <origin>/auth/callback#access_token=...
               ▼
┌──────────────────────────────┐
│ goldenabundance.app/auth/callback   │  SDK picks up session from URL fragment,
│                              │  persists to localStorage, auto-refreshes
│                              │  near expiry; router navigates to returnTo
└──────────────┬───────────────┘
               │ fetch('/api/v1/...', Authorization: Bearer <jwt>)
               ▼
┌──────────────────────────────┐
│ api.goldenabundance.app (Railway)   │  current_user() dep:
│                              │   1. fetch JWKS (cached in-process)
│                              │   2. verify RS256 signature + iss + aud + exp
│                              │   3. resolve UserRow by UUID(claims.sub)
│                              │      (upsert on first call → materializes
│                              │      app-side row for a fresh signup)
└──────────────┬───────────────┘
               │ SQLAlchemy via psycopg3
               ▼
┌──────────────────────────────┐
│ Supabase Postgres            │  role=app_backend, BYPASSRLS, schema=public;
│                              │  never touches auth.* (owned by Supabase)
└──────────────────────────────┘
```

### 3.2 What changes vs. Phase 5

| Layer | Phase 5 (today) | Phase 6+7 (after) |
|---|---|---|
| Identity | email-stub (raw string email-validated) | Real Google OAuth via Supabase |
| JWT algo | HS256, our `JWT_SECRET` | RS256, Supabase-issued, verified via JWKS |
| JWT `sub` | Our own `uuid4()` | Supabase `auth.users.id` UUID |
| `POST /auth/google` | Endpoint mints our JWT | **Deleted** — frontend talks to Supabase directly |
| `POST /auth/logout` | Best-effort no-op | **Deleted** — frontend calls `supabase.auth.signOut()` |
| Frontend token store | `localStorage[ga.token]` | Supabase SDK's own localStorage keys |
| Postgres | `docker-compose` local | Supabase managed, `app_backend` role |
| Hosting | local only | Vercel (frontend) + Railway (backend) |
| Domain | `localhost` | `goldenabundance.app` + `api.goldenabundance.app` |
| CORS origins | permissive dev | `https://goldenabundance.app` only |
| Error handling | `print()` / stdout | Sentry on both tiers, with source maps + release tag |

### 3.3 Non-goals (deferred; rationale tracked in §11)

- Admin role system / news publishing UI
- Supabase custom Auth domain (`auth.goldenabundance.app` — requires Pro)
- Row-Level Security policies
- Refresh-token revocation / session denylist
- Staging environment (separate Supabase project + Railway env)
- Load testing / perf tuning
- GDPR / account-deletion workflows
- Playwright / browser E2E tests
- CSP nonce-based tightening (currently `style-src 'unsafe-inline'` — acceptable at launch)
- Preview deploys with real API access (CORS locks prod backend to prod origin)
- OpenTelemetry / distributed tracing
- Secrets manager (Vault / Doppler / Infisical)

## 4. Sub-plan 6a — Backend auth swap

### 4.1 Pre-requisite Supabase setup (~15 min, done once manually via dashboard)

- Create a Supabase project. Record project reference and JWKS URL.
- **Auth → Providers → Google:** enable; paste Google OAuth Client ID + Secret (obtained in §6.1).
- **Auth → URL Configuration:**
  - Site URL: `https://goldenabundance.app`
  - Additional redirect URLs: `http://localhost:5173/auth/callback`, `https://*.vercel.app/auth/callback` (for PR previews)
- **JWT → Signing Keys:** enable asymmetric (RS256). Note JWKS URL: `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`.
- **Database → Roles:** create `app_backend` role
  - `LOGIN`, `BYPASSRLS`, strong random password
  - `GRANT USAGE ON SCHEMA public`
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public`
  - `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public`
  - `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ...` so future tables inherit grants
  - **Not granted:** access to `auth.*`, `storage.*`, `extensions.*`.

### 4.2 Files — delete

- `backend/src/backend/auth/google_stub.py`
- `backend/src/backend/auth/jwt.py`
- `backend/src/backend/routers/auth.py` (+ its `include_router` call in `server.py`)
- `backend/tests/test_jwt.py` (kills the pre-existing flaky JWT-tamper test tracked under Phase 5e debt — intentional)
- `backend/tests/test_auth_google.py`

### 4.3 Files — new

- `backend/src/backend/auth/supabase.py` — RS256 JWKS verifier with in-process caching:
  ```python
  # Sketch — final shape set by implementer
  from functools import lru_cache
  import jwt as pyjwt
  from jwt import PyJWKClient

  from backend.config import get_settings
  from backend.contract.auth import SupabaseClaims  # pydantic model, new

  @lru_cache(maxsize=1)
  def _jwks_client() -> PyJWKClient:
      return PyJWKClient(
          get_settings().supabase_jwks_url,
          cache_keys=True,
          lifespan=3600,
      )

  def verify_supabase_jwt(token: str) -> SupabaseClaims:
      try:
          signing_key = _jwks_client().get_signing_key_from_jwt(token).key
          raw = pyjwt.decode(
              token,
              signing_key,
              algorithms=["RS256"],
              audience=get_settings().supabase_jwt_aud,  # "authenticated"
              issuer=f"{get_settings().supabase_url}/auth/v1",
          )
      except pyjwt.PyJWTError as exc:
          raise ValueError(str(exc)) from exc
      return SupabaseClaims.model_validate(raw)
  ```
- `backend/src/backend/contract/auth.py` — pydantic `SupabaseClaims` model (`sub: UUID`, `email: EmailStr`, `aud: str`, `exp: int`, `iat: int`).

### 4.4 Files — modify

- `backend/src/backend/auth/dependencies.py` — `current_user()`:
  ```python
  async def current_user(
      authorization: Annotated[str | None, Header()] = None,
      session: AsyncSession = Depends(get_session),
  ) -> UserRow:
      # ... bearer parse unchanged ...
      try:
          claims = verify_supabase_jwt(token)
      except ValueError as exc:
          raise _UNAUTHORIZED from exc
      user = await session.get(UserRow, claims.sub)
      if user is None:
          # Freshly-signed-up Supabase user; materialize app row.
          user = await upsert_user_by_supabase_identity(
              session, auth_user_id=claims.sub, email=claims.email,
          )
      return user
  ```
- `backend/src/backend/services/user.py` — rename `upsert_user_by_email(email)` → `upsert_user_by_supabase_identity(auth_user_id: UUID, email: str)`. Body: `session.get(UserRow, auth_user_id)`; if missing, `INSERT ... ON CONFLICT DO NOTHING` on `id = auth_user_id`, re-fetch, run `display_id` assignment as before.
- `backend/src/backend/db/models.py` — `UserRow.id` loses Python `uuid4()` default (now always supplied from Supabase claims). Alembic migration: **none needed** — fresh Supabase DB means no existing rows.
- `backend/src/backend/config.py`:
  - Remove: `jwt_secret`, `jwt_ttl_seconds`
  - Add: `supabase_url: str` (required; `AnyHttpUrl`), `supabase_jwt_aud: str = "authenticated"`, `supabase_jwks_url: str` (computed property), `sentry_dsn: str | None = None`, `app_release: str | None = None`
  - Production-env validator: require `supabase_url` set + `APP_ENV=prod` rejects localhost URLs
- `backend/src/backend/server.py` — remove `auth.router` from `include_router` block
- `backend/src/backend/seed.py` — seed users `DEMO_USERS` keep their `email` + `display_id` but now take a stable UUID supplied by the seed module (`UUID(int=i)` for each); real Supabase identities materialize at sign-in, not seed time
- `backend/pyproject.toml` — add `pyjwt[crypto]` (upgrade); remove `email-validator` (the stub's only reason for being there)
- `backend/.env.example` — refreshed per §8.1

### 4.5 Seed / data migration

- **Prod:** no migration — fresh Supabase Postgres on first deploy. `alembic upgrade head` creates schema; seed populates `task_defs` + `news_items` only (no DEMO_USERS in prod — that's a dev-only seed, already toggled per Phase 4a).
- **Dev:** `just -f backend/justfile db-reset` wipes local docker-compose Postgres; re-seed emits users with locally-known UUIDs that match the test fixture's minted-token UUIDs. No link to any real Supabase project.
- **Real OAuth against dev:** when a developer wants to test real sign-in locally, they connect local dev frontend to a dev/staging Supabase project (separate from prod), sign in with their personal Google account; `upsert_user_by_supabase_identity` materializes an app row with the real Supabase UUID.

### 4.6 Tests

New fixtures in `backend/tests/conftest.py`:
- `rsa_test_keypair` (session-scoped) — `cryptography`-generated RSA private+public keypair.
- `mint_access_token(user_id: UUID, email: str, *, exp: int | None = None, **overrides) -> str` — returns an RS256-signed JWT mimicking Supabase's claim shape.
- Autouse `stub_jwks` — monkey-patches `_jwks_client()` to return a `PyJWKClient`-shaped stub yielding the local public key.

New test file `backend/tests/test_auth_supabase.py`:
- `test_verify_accepts_valid_supabase_jwt`
- `test_verify_rejects_expired`
- `test_verify_rejects_wrong_issuer`
- `test_verify_rejects_wrong_audience`
- `test_verify_rejects_malformed`
- `test_current_user_upserts_fresh_signup` — first request with a never-seen `sub` creates a `UserRow` with `profile_complete=False`
- `test_current_user_finds_existing_user` — second request with same `sub` returns the same row

All existing Phase-5 integration tests migrate to the new `mint_access_token` helper; service-layer tests unchanged.

## 5. Sub-plan 6b — Frontend auth swap

### 5.1 Packages

- Add: `@supabase/supabase-js` (types bundled).

### 5.2 Files — new

- `frontend/src/lib/supabase.ts` — singleton Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; default storage (localStorage), auto-refresh enabled, `detectSessionInUrl: true` so the callback route auto-extracts.
- `frontend/src/routes/auth.callback.tsx` — route at `/auth/callback`. Body: `await supabase.auth.getSession()`, then `navigate({ to: search.returnTo ?? "/" })`. Handles the OAuth-redirect post-processing.

### 5.3 Files — modify

- `frontend/src/auth/session.tsx`:
  - Rename `signIn(email)` → `signInWithGoogle()` (no email arg). Body: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } })`.
  - `signOut(opts)` calls `supabase.auth.signOut()` **before** the existing cache-clear + router-navigate sequence (dedup guard stays in place).
  - `AuthProvider` subscribes to `supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session))` on mount; unsubscribes on unmount. Initial `signedIn` seeded from `supabase.auth.getSession()` via an async effect.
- `frontend/src/auth/token.ts` — delete or collapse to `export async function getAccessToken(): Promise<string | null>` that pulls from `supabase.auth.getSession()`. Callers become async.
- `frontend/src/api/client.ts` — `apiFetch` awaits `getAccessToken()` on each call instead of synchronous `tokenStore.get()`. 401 handler shape unchanged.
- `frontend/src/screens/GoogleAuthScreen.tsx` — collapse to a single branded "Sign in with Google" button. The curated demo-account picker goes away.
- `frontend/src/routes/sign-in.tsx` — `onSelectAccount` → `onSignIn` (no arg) calls `signInWithGoogle()`; `beforeLoad` switches to `supabase.auth.getSession()` for the "already signed in, bounce to /home or /welcome" short-circuit.
- `frontend/src/queries/me.ts` — no change; `meQueryOptions` still used by `_authed` guard.
- `frontend/src/routes/_authed.tsx` — `beforeLoad` becomes async and awaits `supabase.auth.getSession()` instead of reading `tokenStore.get()` synchronously; redirect target (`/sign-in?returnTo=...`) and `ensureQueryData(meQueryOptions())` call unchanged.
- `frontend/src/main.tsx` — register the new `auth.callback` route in the route tree.
- `frontend/package.json` — add `@supabase/supabase-js`, `@sentry/react`, `@sentry/vite-plugin` (Sentry in §7.2).
- `frontend/.env.example` — refreshed per §8.1.

### 5.4 Files — delete

- `frontend/src/dev/demo-accounts.json`
- `justfile`'s `gen-demo-accounts` recipe
- `backend/src/backend/scripts/dump_demo_accounts.py` (dead after the demo picker is gone)

### 5.5 CSP configuration

New `frontend/vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io; img-src 'self' data: https://*.googleusercontent.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!assets/|auth/callback).*)", "destination": "/index.html" }
  ]
}
```

Notes:
- `unsafe-inline` for styles only — the existing codebase uses inline `style={}` attrs heavily. Tightening to nonces is tracked in §11 as post-launch.
- `connect-src` allowlists Supabase API + Sentry ingest + `self` (our API). Everything else blocked.
- `img-src` allows Google profile pics via `*.googleusercontent.com` (used by Supabase's user metadata avatars).
- `frame-ancestors 'none'` blocks clickjacking.

### 5.6 Tests

- `frontend/src/test/setup.ts` — mock `createClient` from `@supabase/supabase-js` to return a fake client whose `auth.getSession()` + `auth.onAuthStateChange` are test-controlled.
- `frontend/src/auth/__tests__/session.test.tsx` (rewrite) — state transitions (signed-out → signed-in → signed-out); `signInWithGoogle` calls `supabase.auth.signInWithOAuth` with expected args; `signOut` calls `supabase.auth.signOut`, clears cache, navigates.
- `frontend/src/test/msw/handlers.ts` — add handlers for Supabase Auth REST (`/auth/v1/token` for refresh, `/auth/v1/user` for profile fetch).
- Phase 4c's 401-interceptor E2E test (`api/__tests__/client.test.ts`) — rewire to mocked Supabase signOut; assertions unchanged.

### 5.7 Demo-picker disposition

Phase 5's curated picker is deleted entirely. Local dev uses:

1. **Primary:** personal Google account against a dev/staging Supabase project (separate from prod).
2. **Secondary:** `supabase start` CLI (brings up a fully-local Supabase stack in Docker; our frontend points at `http://localhost:54321`).
3. **Automated tests only:** minted RS256 tokens per §4.6.

## 6. Sub-plan 7a — Deploy foundation

### 6.1 Google Cloud Console (~15 min, one-time)

- New GCP project (or existing).
- APIs & Services → Credentials → **Create OAuth 2.0 Client ID (Web application)**.
- Authorized JavaScript origins: `https://goldenabundance.app`, `http://localhost:5173`.
- Authorized redirect URIs: `https://<supabase-ref>.supabase.co/auth/v1/callback`.
- Copy Client ID + Secret → Supabase Auth → Providers → Google (§4.1).

### 6.2 DNS

At registrar (Namecheap / Cloudflare / wherever `goldenabundance.app` is bought):

- Apex `goldenabundance.app` → Vercel. Prefer CNAME flattening (Cloudflare, Porkbun) if the registrar supports it; otherwise `A 76.76.21.21` (Vercel's apex IP — confirm current value in Vercel's domain UI).
- Subdomain `api.goldenabundance.app` CNAME → `<project>.up.railway.app` (Railway displays the exact value after custom-domain config).
- TTL 300s during launch week — fast rollback if DNS is wrong. Raise to 3600s after launch.

### 6.3 Backend (Railway)

New `backend/Dockerfile` (multi-stage, Python 3.12 slim + uv):

```dockerfile
FROM python:3.12-slim AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime
WORKDIR /app
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

Railway project config:
- Root directory: `backend/`
- Builder: Dockerfile
- Custom domain: `api.goldenabundance.app` (auto-SSL via Let's Encrypt)
- Healthcheck path: `/health`

Env vars (Railway UI):

| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase connection string for the `app_backend` role, with `?sslmode=require`. Use the direct (5432) connection for Railway's stateful single-instance deploy; move to pooler (6543) only if connection pressure ever shows up, with `prepare_threshold=None` on psycopg3 to disable prepared statements. |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_JWT_AUD` | `authenticated` |
| `APP_ENV` | `prod` |
| `CORS_ORIGINS` | `https://goldenabundance.app` |
| `APP_RELEASE` | `${{RAILWAY_GIT_COMMIT_SHA}}` (Railway template var) |
| `SENTRY_DSN` | (set in §7.1) |

Migrations run as part of container startup (CMD's `alembic upgrade head`). Failed migration → non-zero exit → Railway keeps the previous deployment live. Alembic is idempotent, so re-runs are safe.

### 6.4 Frontend (Vercel)

Vercel project config:
- Root directory: `frontend/`
- Framework preset: Vite
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Output directory: `dist`
- Custom domain: `goldenabundance.app` apex (auto-SSL via Let's Encrypt)

Env vars (Vercel UI, set for Production + Preview):

| Var | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | public anon JWT from Supabase → Settings → API |
| `VITE_SENTRY_DSN` | (set in §7.2) |
| `VITE_RELEASE` | `${VERCEL_GIT_COMMIT_SHA}` |
| `SENTRY_AUTH_TOKEN` | build-time only, upload source maps; Vercel secret |

Preview deploys inherit these env vars and hit **the same prod Supabase + prod backend**. CORS is locked to `https://goldenabundance.app` only; preview API calls CORS-fail. Accepted tradeoff per Q7A — previews are for visual review, not full E2E. Developers wanting real backend access against a preview UI fall back to local dev.

`vercel.json` (per §5.5) handles CSP + SPA rewrite + security headers.

### 6.5 Supabase Postgres setup summary

Covered in §4.1. Reiterated here because it's the single most-forgettable prereq:

- `app_backend` role with `BYPASSRLS` + grants on `public` schema only
- `DATABASE_URL` in Railway uses this role (never `postgres`, never `service_role`, never `anon`)
- Supabase's daily backup (free plan — 7-day retention) is acceptable for MVP; external backup tracked in §11

## 7. Sub-plan 7b — Observability + launch polish

### 7.1 Sentry backend

- `backend/pyproject.toml` → add `sentry-sdk[fastapi]`.
- `backend/src/backend/server.py::create_app`:
  ```python
  if settings.sentry_dsn:
      sentry_sdk.init(
          dsn=settings.sentry_dsn,
          environment=settings.app_env,
          release=settings.app_release,
          traces_sample_rate=0.1,
          profiles_sample_rate=0.0,
          send_default_pii=False,
      )
  ```
- `send_default_pii=False` keeps email / user_id out of error reports by default. Opt-in to user-id tagging (not email) inside `current_user()` via `sentry_sdk.set_user({"id": str(user.id)})` — so errors are correlatable to a user without leaking PII to Sentry.

### 7.2 Sentry frontend

- `frontend/package.json` → add `@sentry/react`, `@sentry/vite-plugin`.
- `frontend/src/main.tsx` — init Sentry before React renders:
  ```typescript
  import * as Sentry from "@sentry/react";
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_RELEASE,
      tracesSampleRate: 0.1,
    });
  }
  ```
- Wrap the router with `Sentry.ErrorBoundary` so component-tree crashes land in Sentry with useful stack traces instead of blank-screening.
- `frontend/vite.config.ts` — register the Sentry plugin conditional on `SENTRY_AUTH_TOKEN`; upload source maps per release during Vercel build.

### 7.3 UptimeRobot

Manual setup in UptimeRobot dashboard (free plan: 50 monitors, 5-min interval):

- Monitor 1: `GET https://api.goldenabundance.app/health` — 200 expected
- Monitor 2: `GET https://goldenabundance.app/` — 200 expected
- Alert contact: your email (SMS or Slack available on paid plans)
- Optional: public status page URL (`stats.uptimerobot.com/...`) as a trust signal

### 7.4 CI — GitHub Actions

New `.github/workflows/ci.yml`:

- Triggers: `pull_request`, `push` to `main`
- Jobs:
  - `backend`: checkout → `astral-sh/setup-uv@v4` → `just -f backend/justfile ci` (already covers lint, format-check, typecheck, contract-validate, pytest with testcontainers Postgres)
  - `frontend`: checkout → `pnpm/action-setup@v4` → `cd frontend && pnpm install --frozen-lockfile && pnpm lint && pnpm exec tsc --noEmit && pnpm test`
- No deploy step — Vercel + Railway each have their own GitHub integrations that auto-deploy on push to `main`.
- Branch protection on `main` requires both CI jobs to pass before merge. Deploy happens post-merge via the platform integrations.

### 7.5 Launch checklist (manual, gates go-live)

- [ ] End-to-end sign-in on prod URL with your personal Google account → profile-setup screen → home feed
- [ ] Submit T1/T2 task; reward arrives in `/rewards`
- [ ] Team creation + join-request + approve flow works end-to-end from two accounts
- [ ] Deliberate `raise Exception("sentry smoke")` from a test endpoint + `throw new Error(...)` from a dev-only button; both appear in Sentry with source maps + release tag
- [ ] Both UptimeRobot monitors report green for 30+ min
- [ ] `securityheaders.com` grade for `goldenabundance.app`: A or better (verifies CSP + HSTS + Referrer-Policy + Permissions-Policy + X-Frame-Options + X-Content-Type-Options all present)
- [ ] `curl -H "Origin: https://evil.example" https://api.goldenabundance.app/api/v1/me` → no `Access-Control-Allow-Origin` header returned (CORS rejects)
- [ ] `curl https://api.goldenabundance.app/api/v1/me` with no `Authorization` → 401
- [ ] Sign in from a second Google account (not pre-seeded) → fresh `UserRow` materialized, profile setup works
- [ ] Sign out → redirected to `/sign-in` → `GET /api/v1/me` now returns 401
- [ ] Supabase default Auth rate limits reviewed (60 sign-ups/hour default — request higher in Supabase support if launch-day spike expected)
- [ ] DNS propagation verified (`dig goldenabundance.app`, `dig api.goldenabundance.app` from external resolver)
- [ ] `/health` green under load of ~10 concurrent requests (launch-day baseline)

## 8. Cross-cutting concerns

### 8.1 Environment variables (consolidated)

Three places env vars live:

**Supabase dashboard** (canonical for auth):
- Google OAuth Client ID + Secret (from GCP)
- Project's JWT signing key (RS256, managed by Supabase)
- Anon key (public; baked into frontend bundle)
- Service role key (never used by our code — kept in dashboard only)

**Railway (backend runtime):**
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_AUD`, `APP_ENV`, `CORS_ORIGINS`, `APP_RELEASE`, `SENTRY_DSN`

**Vercel (frontend build+runtime):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_RELEASE` — baked into client bundle
- `SENTRY_AUTH_TOKEN` — build-time only, Vercel secret, uploads source maps

**Local dev:**
- `backend/.env` — `DATABASE_URL` (docker-compose Postgres), `SUPABASE_URL` (dev Supabase project, if using real auth locally), `APP_ENV=dev`; `.env.example` refreshed
- `frontend/.env.local` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (dev Supabase project); `.env.example` refreshed

### 8.2 Secrets rotation

| Secret | Rotation trigger | Process |
|---|---|---|
| Supabase JWT signing key | Supabase-managed (automatic) | Our JWKS client picks up new keys on next cache miss; zero deploys |
| `DATABASE_URL` password | Every 6 months, or on team-departure | Rotate via Supabase dashboard → update Railway env → redeploy backend |
| `VITE_SUPABASE_ANON_KEY` | On Supabase project reset | Rotate in Supabase → update Vercel env → redeploy frontend (anon key is public but still env-var'd) |
| Google OAuth Client Secret | Every 12 months | Rotate in GCP → update Supabase → no app redeploy needed |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Never (public DSN) | — |
| `SENTRY_AUTH_TOKEN` | On team-departure | Rotate in Sentry → update Vercel secret |

### 8.3 Config / file changes summary

Backend:
- `backend/src/backend/config.py` — remove `JWT_SECRET`/`JWT_TTL_SECONDS`; add `SUPABASE_URL`, `SUPABASE_JWT_AUD`, `SENTRY_DSN`, `APP_RELEASE`
- `backend/pyproject.toml` — add `pyjwt[crypto]`, `sentry-sdk[fastapi]`; remove `email-validator`
- NEW `backend/Dockerfile` (§6.3)
- `backend/.env.example` — refreshed
- `backend/src/backend/seed.py` — DEMO_USERS stable UUIDs per §4.5

Frontend:
- `frontend/package.json` — add `@supabase/supabase-js`, `@sentry/react`, `@sentry/vite-plugin`
- NEW `frontend/vercel.json` (§5.5)
- `frontend/vite.config.ts` — Sentry plugin registration
- `frontend/.env.example` — refreshed

Repo-level:
- `justfile` — delete `gen-demo-accounts` recipe
- NEW `.github/workflows/ci.yml` (§7.4)

## 9. Testing strategy

### 9.1 Backend

- Pytest + testcontainers Postgres (Phase 5 infra — unchanged).
- Auth fixtures swap from HS256-signing to RS256-signing with local keypair + stubbed JWKS (§4.6).
- New: `test_auth_supabase.py` covers verification happy + failure paths.
- Existing Phase-5 integration tests keep running; only the token-minting fixture changes.

### 9.2 Frontend

- Vitest + MSW (Phase 4c infra — unchanged).
- `@supabase/supabase-js` mocked at module boundary; test helpers inject session state.
- MSW handlers for Supabase Auth REST (`/auth/v1/token`, `/auth/v1/user`).
- Rewrite: `auth/__tests__/session.test.tsx` (signIn/signOut flows).
- Reuse: 401-interceptor E2E test, redirected mocks.

### 9.3 Not in scope

- Playwright / real-browser E2E — pytest integration + vitest component + manual launch-checklist smoke is enough for MVP. Revisit if manual regression becomes a time sink.
- Load/perf testing — out of phase.

### 9.4 CI gates

- PR must pass both CI jobs before merge.
- Branch protection on `main` enforces this.
- Vercel + Railway deploy on push to `main` — in practice CI runs first because branch protection makes CI a merge prerequisite, but the platforms don't explicitly wait for GH Actions.

## 10. Rollback strategy

- **Backend:** Railway → Deployments → "Redeploy" against a prior build. One click.
- **Frontend:** Vercel → Deployments → "Promote to Production" against an earlier deployment. One click.
- **DB:** Alembic `downgrade` exists but is untested for our migrations; treat as forward-fix-only except in catastrophe. Phase 6+7 has zero required schema changes — the `UserRow.id` default change is a Python-side default only, no ALTER TABLE.
- **DNS:** TTL held at 300s during launch week so A/CNAME changes propagate out in under 5 min.
- **Auth config:** if the Google OAuth integration breaks mid-launch, temporarily disable Google provider in Supabase dashboard → users get a clear error rather than a half-broken state.

## 11. Out of scope / deferred

| # | Item | Revisit when |
|---|---|---|
| 1 | Admin role system + news publishing UI | Editorial workflow becomes real; insert via Supabase SQL editor until then |
| 2 | Supabase custom Auth domain (`auth.goldenabundance.app`) | Post-launch; requires Pro plan ($25/mo) |
| 3 | RLS policies | If Supabase Realtime or non-FastAPI direct-DB access is ever added |
| 4 | Refresh-token revocation / per-session kill switch | If abuse or credential-compromise becomes a real concern |
| 5 | Staging environment (second Supabase project + Railway env) | After first scary migration or when team grows past 2 engineers |
| 6 | Load / perf testing | When traffic warrants (>1k DAU or launch-campaign spike planned) |
| 7 | GDPR account-deletion endpoint | Before formally serving EU-resident users; for launch, "contact support" flow |
| 8 | Playwright / browser E2E | When manual smoke becomes a regression-miss source |
| 9 | CSP nonce-based tightening (remove `style-src 'unsafe-inline'`) | Post-launch hardening pass |
| 10 | Preview deploys with real API access | If preview E2E becomes a team need |
| 11 | OpenTelemetry / distributed tracing | When single-service Sentry traces are insufficient |
| 12 | DB backups beyond Supabase's default 7-day retention | When data-loss risk grows or a compliance ask lands |
| 13 | Secrets manager (Vault / Doppler / Infisical) | When team grows past ~3 engineers or secrets count grows past ~20 |

## 12. Sequencing + merge order

Strictly linear: **6a → 6b → 7a → 7b**. Each sub-plan is one PR. Reviewer blocks on each before the next is started.

- **6a → 6b:** frontend needs backend's token shape + `current_user` semantics stable.
- **6b → 7a:** deploying backend without frontend auth-swap means deploying with a hard-broken auth surface (the stub is torn out in 6a; nothing replaces it until 6b lands).
- **7a → 7b:** observability should wrap a deployed and working surface — adding Sentry to a broken deploy just fills Sentry with import-time errors.

Estimated calendar: ~1–2 weeks of focused work by one engineer, dominated by the Supabase / GCP / Railway / Vercel / DNS config clicking (not the code).

## 13. Open questions (none blocking)

- **Supabase plan selection** — Free tier is sufficient for launch. Upgrade to Pro ($25/mo) when the custom Auth domain becomes a real branding ask or Supabase daily limits are hit.
- **Email deliverability** — Supabase sends email magic-links from `noreply@mail.supabase.io` by default. We're not using email auth (Google-only), so this is moot unless email auth is added later.
- **Locale handling for Google consent screen** — Google detects from browser `Accept-Language`. Site UI is already Traditional Chinese in places + Simplified in others (Phase 3 tech-debt item). Not a launch blocker; tracked there.
