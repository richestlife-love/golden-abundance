# Phase 7b — Observability + Launch Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the deployed app (plan 7a) in error reporting, uptime monitoring, and CI gating before public launch. Sentry on both backend and frontend with source maps + release tagging. UptimeRobot pings `/health` and the apex every 5 minutes. GitHub Actions runs the full backend + frontend CI on every PR. A concrete launch checklist closes out Phase 6+7.

**Prereqs:** Plan 7a merged and live at `goldenabundance.app` + `api.goldenabundance.app`. Sentry account (free tier).

**Architecture:** No business-logic changes. Additive instrumentation: one `sentry_sdk.init()` call in `server.py`, one `Sentry.init()` call in `main.tsx`, a Vite plugin that uploads source maps to Sentry at build time. CI workflow runs what `just -f backend/justfile ci` + `pnpm -C frontend` scripts already cover; no new test infra.

**Tech Stack:** `sentry-sdk[fastapi]`, `@sentry/react`, `@sentry/vite-plugin`, UptimeRobot (SaaS, free tier), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §7 (Sub-plan 7b).

**Exit criteria:**
- A deliberate `raise Exception("sentry smoke")` from a one-off test endpoint lands in the backend's Sentry project with source-resolved stack trace + release tag.
- `throw new Error("sentry smoke")` from a deliberately-wired button on a dev-only route lands in the frontend's Sentry project with source-mapped stack trace + release tag.
- Both UptimeRobot monitors green for ≥30 min.
- `.github/workflows/ci.yml` runs backend + frontend CI on push and pull_request; branch protection on `main` requires both jobs pass.
- Launch checklist (§7.5 of the design spec) fully checked off.

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Sentry backend integration | `sentry-sdk[fastapi]` with `traces_sample_rate=0.1` | Ships performance traces + error reports in one SDK. 10% sample rate fits the free-tier budget at launch traffic. |
| Sentry frontend integration | `@sentry/react` with `ErrorBoundary` around the router | Component-tree crashes land in Sentry instead of blank-screening. |
| Source maps | `@sentry/vite-plugin` uploads per release on Vercel build | Stack traces point at readable source lines. |
| PII handling | `send_default_pii=False` on backend; user-id tagging only (no email) | Minimizes what leaks to Sentry. |
| UptimeRobot | Free plan, 5-min interval, email alert | Cheapest signal before traffic warrants paid. |
| CI | GitHub Actions — `backend` + `frontend` jobs, parallel | Vercel + Railway deploy on push; CI is a branch-protection gate, not the deployer. |

---

## File plan

| Path | Action | Contents |
|---|---|---|
| `backend/pyproject.toml` | M | Add `sentry-sdk[fastapi]` |
| `backend/src/backend/config.py` | M | Confirm `sentry_dsn` + `app_release` fields are used (they already exist from 6a) |
| `backend/src/backend/server.py` | M | `sentry_sdk.init(...)` in `create_app()` |
| `backend/src/backend/auth/dependencies.py` | M | `sentry_sdk.set_user({"id": ...})` after user resolves |
| `backend/tests/test_sentry_init.py` | C | Smoke that `create_app()` with `SENTRY_DSN` set installs a Sentry hub |
| `frontend/package.json` | M | Add `@sentry/react` + `@sentry/vite-plugin` |
| `frontend/src/main.tsx` | M | `Sentry.init()` before React renders + `Sentry.ErrorBoundary` wrap |
| `frontend/src/routes/__root.tsx` | M | Optional: wrap `<RouterProvider>` in `Sentry.ErrorBoundary` if `main.tsx` isn't the right spot for the wrap |
| `frontend/vite.config.ts` | M | Register `sentryVitePlugin` guarded on `SENTRY_AUTH_TOKEN` |
| `frontend/.env.example` | M | Add `VITE_SENTRY_DSN` |
| `.github/workflows/ci.yml` | C | Backend + frontend CI |

---

## Section A — Sentry backend

**Exit criteria:** Start the backend locally with `SENTRY_DSN` set; a deliberate error surfaces in the Sentry UI within ~30s.

### Task A1: Add the SDK

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/src/backend/config.py` (verify Sentry fields exist from 6a)

- [ ] **Step 1: Add `sentry-sdk[fastapi]` to dependencies**

Append to the `dependencies` list in `backend/pyproject.toml`:

```toml
  "sentry-sdk[fastapi]>=2.17.0",
```

Run `uv sync`:

```bash
(cd backend && uv sync --all-extras --dev)
```

- [ ] **Step 2: Add `sentry_dsn` + `app_release` fields to `Settings`**

Plan 6a's config.py rewrite covers Supabase fields only — these observability-scoped fields are owned by 7b. In `backend/src/backend/config.py`, add inside the `Settings` class body (e.g., right after `app_env`):

```python
    sentry_dsn: str | None = Field(default=None)
    app_release: str | None = Field(default=None)
```

If 6a later evolves to add them first, this becomes a no-op and the next step still passes. Skip only if you can visually confirm both fields are already declared.

- [ ] **Step 3: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/src/backend/config.py
git commit -m "chore(backend): add sentry-sdk dependency (Phase 7b)"
```

### Task A2: Initialize Sentry in `create_app`

**Files:**
- Modify: `backend/src/backend/server.py`
- Modify: `backend/src/backend/auth/dependencies.py`
- Create: `backend/tests/test_sentry_init.py`

- [ ] **Step 1: Write the failing test**

```python
"""Smoke that Sentry init only fires when SENTRY_DSN is set."""

import pytest

from backend.config import get_settings
from backend.server import create_app


def test_create_app_without_sentry_dsn_does_not_init(monkeypatch) -> None:
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    get_settings.cache_clear()

    # If create_app tried to contact a real Sentry, the test would hang.
    # No DSN means no init; app builds cleanly.
    app = create_app()
    assert app.title.startswith("Golden Abundance")


def test_create_app_with_sentry_dsn_installs_hub(monkeypatch) -> None:
    """With a DSN set, sentry_sdk has a bound client after init."""
    import sentry_sdk

    monkeypatch.setenv(
        "SENTRY_DSN",
        "https://public@o0.ingest.sentry.io/0",  # valid-shape fake; SDK accepts without network round-trip
    )
    monkeypatch.setenv("APP_RELEASE", "test-release-7b")
    get_settings.cache_clear()

    try:
        create_app()
        client = sentry_sdk.get_client()
        assert client is not None
        # Client.dsn's string form has been normalized across sdk versions;
        # match the prefix rather than the literal DSN string.
        assert str(client.dsn).startswith("https://public@")
    finally:
        # sentry_sdk.init() is process-global; close so subsequent tests
        # aren't observing leaked state from this one.
        sentry_sdk.get_client().close()
```

Save to `backend/tests/test_sentry_init.py`.

- [ ] **Step 2: Run — expect FAIL (Sentry never installs today)**

```bash
(cd backend && uv run pytest tests/test_sentry_init.py -v)
```

Expected: second test FAILs on `client is None`.

- [ ] **Step 3: Update `backend/src/backend/server.py`**

Top of file, add:

```python
import sentry_sdk
```

In `create_app()`, before the `FastAPI(...)` construction:

```python
def create_app() -> FastAPI:
    settings = get_settings()
    if settings.sentry_dsn:
        # sentry-sdk 2.x auto-enables FastApiIntegration + SqlalchemyIntegration
        # when the respective packages are importable — no explicit integrations list needed.
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.app_env,
            release=settings.app_release,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.0,
            send_default_pii=False,
        )

    app = FastAPI(
        title="Golden Abundance API",
        version="0.1.0",
        description="Phase 7 backend — see backend/src/backend/contract/endpoints.md",
    )
    # ... rest of function unchanged
```

- [ ] **Step 4: Attach user-id in the auth dep**

Update `backend/src/backend/auth/dependencies.py`:

Hoist the Sentry import to the top of the module alongside the other imports:

```python
import sentry_sdk
```

Add the Sentry tag right before `return user` at the end of `current_user`:

```python
    sentry_sdk.set_user({"id": str(user.id)})
    return user
```

(`sentry_sdk` is already loaded eagerly by `server.py` at app boot; an in-function import saves nothing and trips Ruff's import-ordering rules.)

- [ ] **Step 5: Run — expect PASS**

```bash
(cd backend && uv run pytest tests/test_sentry_init.py -v)
```

Expected: 2 tests pass.

- [ ] **Step 6: Run full backend CI**

```bash
just -f backend/justfile ci
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/backend/server.py backend/src/backend/auth/dependencies.py backend/tests/test_sentry_init.py
git commit -m "feat(backend): Sentry SDK wiring + user-id tagging (Phase 7b)"
```

### Task A3: Wire `SENTRY_DSN` + `APP_RELEASE` into Railway

**Files:** (Railway dashboard — no files)

- [ ] **Step 1: Create a Sentry project** for the backend

https://sentry.io/ → new project → Platform: **FastAPI**. Copy the DSN.

- [ ] **Step 2: Paste into Railway**

Railway → your backend service → Variables → add `SENTRY_DSN` = (the DSN you just copied).

`APP_RELEASE` was already set in plan 7a as `${{RAILWAY_GIT_COMMIT_SHA}}`; verify it's there. If not, add it.

- [ ] **Step 3: Trigger a redeploy**

Push any small commit (or click "Deploy now" in Railway) to pick up the new env var.

- [ ] **Step 4: Smoke — deliberate error**

Temporarily add a route that raises, deploy, hit it, then revert.

In `backend/src/backend/routers/health.py` (or a new `sentry_smoke.py`):

```python
@router.get("/debug/sentry-smoke")
def sentry_smoke() -> None:
    raise RuntimeError("sentry smoke test — Phase 7b")
```

Commit + push. Wait for Railway to deploy. Hit:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.goldenabundance.app/debug/sentry-smoke
```

Expected: `500`.

Check Sentry → Issues. Expected within ~30s: a new issue titled `RuntimeError: sentry smoke test — Phase 7b`, tagged with the commit SHA release and `environment=prod`.

- [ ] **Step 5: Revert the debug endpoint**

```bash
git revert HEAD
git push
```

Let Railway redeploy. Confirm `/debug/sentry-smoke` now 404s.

---

## Section B — Sentry frontend

**Exit criteria:** `throw new Error()` in the rendered app lands in the Sentry frontend project with source-mapped lines + release tag.

### Task B1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

```bash
(cd frontend && pnpm add @sentry/react @sentry/vite-plugin)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(frontend): add @sentry/react + vite plugin (Phase 7b)"
```

### Task B2: Initialize Sentry in `main.tsx`

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Update `frontend/src/main.tsx`**

Full file:

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { AuthProvider } from "./auth/session";
import { UIStateProvider } from "./ui/UIStateProvider";
import { queryClient } from "./queryClient";
import { createAppRouter, setRouterRef } from "./router";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    tracesSampleRate: 0.1,
    // Replay / profiling deliberately off for MVP launch. Revisit post-launch.
  });
}

const router = createAppRouter({ queryClient });
setRouterRef(router);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error }) => (
        <div style={{ padding: 32 }}>
          <h1>出了點問題</h1>
          <pre style={{ fontSize: 12, color: "#666" }}>
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UIStateProvider>
            <RouterProvider router={router} />
          </UIStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
```

- [ ] **Step 2: Update `frontend/.env.example`**

Append to the existing file:

```env

# Sentry DSN for browser error reporting (public; baked into bundle).
VITE_SENTRY_DSN=https://public@o0.ingest.sentry.io/0
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm -C frontend exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Run tests**

```bash
pnpm -C frontend test
```

Expected: green. Existing tests don't set `VITE_SENTRY_DSN`, so init is a no-op in tests — no additional mocking needed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.tsx frontend/.env.example
git commit -m "feat(frontend): Sentry init + ErrorBoundary wrap (Phase 7b)"
```

### Task B3: Vite plugin for source-map upload

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Update `frontend/vite.config.ts`**

Full file:

```typescript
/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

const DEFAULT_PORT = 5173;
const DEFAULT_API_BASE_URL = "http://localhost:8000";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.VITE_PORT) || DEFAULT_PORT;
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(",")
        .map((h) => h.trim())
        .filter(Boolean)
    : [];

  const plugins: Plugin[] = [react()];
  if (env.SENTRY_AUTH_TOKEN && env.VITE_RELEASE) {
    plugins.push(
      sentryVitePlugin({
        authToken: env.SENTRY_AUTH_TOKEN,
        org: env.SENTRY_ORG ?? "goldenabundance",
        project: env.SENTRY_PROJECT ?? "goldenabundance-frontend",
        release: { name: env.VITE_RELEASE },
        sourcemaps: { assets: "./dist/**" },
      }),
    );
  }

  return {
    plugins,
    build: {
      // "hidden" emits .map files so the Sentry plugin can upload them, but
      // doesn't add a `//# sourceMappingURL=` comment to the bundle — real
      // visitors don't fetch source maps; only Sentry resolves stack traces.
      sourcemap: "hidden",
    },
    server: {
      port,
      host: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
          changeOrigin: true,
        },
      },
    },
    preview: { port },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
```

Key additions:
- `build.sourcemap: "hidden"` — Vite emits `.map` files alongside each bundle, but without the `sourceMappingURL` comment that would cause browsers to fetch them publicly. The Sentry plugin picks up the hidden maps from disk at upload time.
- Sentry plugin registered conditionally — local dev builds without `SENTRY_AUTH_TOKEN` skip the upload.

- [ ] **Step 2: Build locally**

```bash
pnpm -C frontend build
ls -la frontend/dist/assets/ | head
```

Expected: `.js` files each have a matching `.js.map` sibling.

Source maps won't upload without `SENTRY_AUTH_TOKEN`; that's set in Vercel (next task).

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "build(frontend): Sentry source-map upload plugin (Phase 7b)"
```

### Task B4: Wire env vars into Vercel + create Sentry project

**Files:** (Vercel + Sentry dashboards)

- [ ] **Step 1: Create a Sentry project for the frontend**

https://sentry.io/ → new project → Platform: **React**. Copy the DSN.

- [ ] **Step 2: Create a Sentry auth token**

Sentry → Settings → Account → API → Auth Tokens → Create new token with scopes:
- `project:releases`
- `org:read` (needed by the Vite plugin to resolve org/project IDs)

Copy the token — it won't be shown again.

- [ ] **Step 3: Paste into Vercel**

Vercel → Settings → Environment Variables → add for Production and Preview:

| Var | Value |
|---|---|
| `VITE_SENTRY_DSN` | the frontend DSN from Step 1 (Production + Preview) |
| `SENTRY_AUTH_TOKEN` | the token from Step 2 (mark as **Secret**, Production only) |
| `SENTRY_ORG` | your Sentry org slug (Production only) |
| `SENTRY_PROJECT` | `goldenabundance-frontend` (or whatever you named it) (Production only) |

Note: `SENTRY_AUTH_TOKEN` without `VITE_` prefix because it's only used at build time, never baked into the client bundle.

- [ ] **Step 4: Trigger a Vercel redeploy**

Push any small commit or click Deploy. Build logs should show Sentry plugin uploading source maps:

```
Sentry CLI: uploading source maps for release <sha>
Uploaded <N> files to <SENTRY_ORG>/<SENTRY_PROJECT>
```

- [ ] **Step 5: Smoke — deliberate error from the browser**

Temporarily add a render-time throw, gated by a query-string flag so real visitors can't trip it during the smoke window. React's `ErrorBoundary` only catches errors thrown during **render** (not in event handlers), so we put the throw inside a child component that renders conditionally on a state flag.

In a visible spot (e.g., the bottom of `HomeScreen` or `MeScreen`), add:

```tsx
import { useState } from "react";

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("sentry smoke test — Phase 7b");
  return null;
}

function SentrySmokeButton() {
  const [explode, setExplode] = useState(false);
  const armed =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "sentry";
  if (!armed) return null;
  return (
    <>
      <button
        style={{ marginTop: 24, fontSize: 11, color: "#999" }}
        onClick={() => setExplode(true)}
      >
        (debug: trigger render-time error)
      </button>
      <Bomb explode={explode} />
    </>
  );
}
```

Place `<SentrySmokeButton />` inside the screen's return tree.

Commit, push, wait for Vercel build. Visit `https://goldenabundance.app/?debug=sentry` and click the button. The next render throws inside `<Bomb>`, `Sentry.ErrorBoundary` catches it and renders the "出了點問題" fallback, and Sentry's global handler reports the crash. Within ~30s, a new issue appears in Sentry → Issues (frontend project) with source-mapped line numbers and the `VITE_RELEASE` git SHA as the release tag.

- [ ] **Step 6: Revert the smoke component**

```bash
git revert HEAD
git push
```

After Vercel redeploys, re-visit `?debug=sentry` and confirm the button no longer renders.

---

## Section C — UptimeRobot

**Exit criteria:** Two monitors green, alert email on configured contact.

### Task C1: Configure monitors

**Files:** (UptimeRobot dashboard)

- [ ] **Step 1: Sign up at https://uptimerobot.com/** (free plan).

- [ ] **Step 2: Add monitor 1**

Type: HTTP(s). URL: `https://api.goldenabundance.app/health`. Friendly Name: `goldenabundance api`. Monitoring Interval: 5 minutes.

- [ ] **Step 3: Add monitor 2**

Type: HTTP(s). URL: `https://goldenabundance.app/`. Friendly Name: `goldenabundance web`. Monitoring Interval: 5 minutes.

- [ ] **Step 4: Configure alert contact**

Settings → My Settings → Alert Contacts → Add → Email (or Slack webhook if you'd rather). Attach to both monitors.

- [ ] **Step 5: Verify**

Wait 5–10 min. Both monitors show green. To verify the alert contact without taking prod down, use UptimeRobot → Alert Contacts → "Test" (sends a one-shot test notification to the configured email/webhook). Skip the "briefly pause Railway" approach — it's easy to fat-finger and leave prod offline.

- [ ] **Step 6: (Optional) Public status page**

UptimeRobot free plan includes a basic public status page (`stats.uptimerobot.com/<slug>`). Enable if you want a trust signal to share.

No commits — UptimeRobot state lives in their dashboard.

---

## Section D — GitHub Actions CI

**Exit criteria:** `push` and `pull_request` run backend + frontend CI jobs; branch protection on `main` requires both pass.

### Task D1: Write the workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

# Cancel superseded runs on PRs; let main-branch runs finish (they produce
# the deploy signal + branch-protection status we care about).
concurrency:
  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  backend:
    name: backend
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "0.11.7"
          python-version: "3.14"

      - name: Sync deps
        run: uv sync --all-extras --dev

      - name: Lint
        run: uv run ruff check

      - name: Format check
        run: uv run ruff format --check

      - name: Typecheck
        run: uv run ty check

      - name: Validate contract fixtures
        run: uv run python -m backend.contract.validate_examples

      - name: Test
        # pyproject.toml's addopts already sets `-v --cov` and the coverage
        # report gate (`fail_under = 90`); no flag overrides needed here.
        run: uv run pytest

  frontend:
    name: frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "0.11.7"
          python-version: "3.14"

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.33.0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
          cache-dependency-path: frontend/pnpm-lock.yaml

      # `frontend/src/api/schema.d.ts` is gitignored and regenerated from the
      # backend's OpenAPI. tsc --noEmit imports from it transitively, so it
      # MUST exist before the typecheck step.
      - name: Sync backend deps (for OpenAPI generator)
        working-directory: backend
        run: uv sync --all-extras --dev

      - name: Generate frontend OpenAPI types
        run: |
          uv run --project backend python -c 'import json; from backend.server import app; print(json.dumps(app.openapi()))' > /tmp/ga-openapi.json
          pnpm dlx openapi-typescript /tmp/ga-openapi.json -o frontend/src/api/schema.d.ts

      - name: Install frontend deps
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Lint
        working-directory: frontend
        run: pnpm lint

      - name: Typecheck
        working-directory: frontend
        run: pnpm exec tsc --noEmit

      - name: Test
        working-directory: frontend
        run: pnpm test
```

- [ ] **Step 2: Push + verify both jobs run on the PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: backend + frontend jobs on PR/main (Phase 7b)"
git push
```

Open the resulting PR (or push to a branch + open). Both jobs should appear under "Checks" and go green within ~5 min.

- [ ] **Step 3: Enable branch protection**

GitHub → repo → Settings → Branches → Branch protection rules → Add rule:
- Branch name pattern: `main`
- Require a pull request before merging: **on**
- Require status checks to pass: **on**
  - Required status checks: `backend`, `frontend`
- Require branches to be up to date before merging: **on**
- Restrict pushes that create matching branches: leave off unless you have collaborators.

Save. Attempt a direct push to `main` — GitHub should reject.

---

## Section E — Launch checklist

**Exit criteria:** Every item in §7.5 of the design spec is checked off. Phase 6+7 is done.

### Task E1: Execute the checklist

**Files:** (manual; no code changes unless a smoke fails)

Run each of these in an incognito browser window, signed into a personal Google account (not pre-seeded):

- [ ] **Step 1:** Open `https://goldenabundance.app` → click sign-in → Google consent → back to `goldenabundance.app/auth/callback` → lands on `/welcome` (if first time) → complete profile → lands on `/home`.

- [ ] **Step 2:** Submit T1 (interest form) → success overlay fires → `/rewards` shows +50 points.

- [ ] **Step 3:** Submit T2 (ticket form). Check reward ledger updates.

- [ ] **Step 4:** From a second Google account, sign in → complete profile → send join request to first account's led team → from account 1, approve → both sides reflect the change.

- [ ] **Step 5:** Deliberate backend error (if not already smoked in A3) — add + remove a `/debug/sentry-smoke` endpoint, hit it once, verify Sentry receives with source-resolved trace + release SHA.

- [ ] **Step 6:** Deliberate frontend error (if not already smoked in B4) — add + remove a dev button, click once, verify Sentry receives with source-mapped trace + release SHA.

- [ ] **Step 7:** UptimeRobot: both monitors reporting green for ≥30 consecutive minutes.

- [ ] **Step 8:** Security headers:

```bash
curl -sI https://goldenabundance.app \
  | grep -ciE 'content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security'
```

Expect `6` — five from `frontend/vercel.json` (CSP + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy) plus HSTS auto-added by Vercel. A lower count means one is missing — dig into `frontend/vercel.json`. Then confirm grade at https://securityheaders.com/?q=https%3A%2F%2Fgoldenabundance.app — expect **A** or better.

- [ ] **Step 9:** CORS smoke:

```bash
curl -sI -H 'Origin: https://evil.example' https://api.goldenabundance.app/api/v1/me \
  | grep -i 'access-control-allow-origin' || echo 'CORS rejects ✓'
```

Expected: `CORS rejects ✓`.

- [ ] **Step 10:** Auth smoke:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.goldenabundance.app/api/v1/me
```

Expected: `401`.

- [ ] **Step 11:** Sign out on `goldenabundance.app` → redirect to `/sign-in` → bare URL `https://goldenabundance.app/me` bounces to `/sign-in?returnTo=%2Fme`.

- [ ] **Step 12:** DNS propagation check from a fresh external resolver:

```bash
dig +short goldenabundance.app @1.1.1.1
dig +short api.goldenabundance.app @1.1.1.1
```

Both should resolve.

- [ ] **Step 13:** Supabase rate-limit review. Dashboard → Authentication → Rate Limits. Default 60/hr for sign-ups. If an initial launch-day push is expected above that, file a Supabase support ticket for a temporary bump.

- [ ] **Step 14:** Final commit — mark the `production-launch-plan.md` Phase 6 + 7 items as complete:

```bash
# Edit docs/production-launch-plan.md to check the Phase 6 + 7 boxes
git add docs/production-launch-plan.md
git commit -m "docs: mark Phase 6+7 complete in production launch plan"
git push
```

---

## Final self-check — production launch open

- [ ] End-to-end OAuth works on prod URL.
- [ ] Sentry receives errors from both tiers with source resolution.
- [ ] UptimeRobot monitors green.
- [ ] GitHub Actions CI gates `main`.
- [ ] Security headers grade ≥ A on securityheaders.com.
- [ ] All checklist items in §7.5 of the design spec complete.
- [ ] `docs/production-launch-plan.md` Phase 6 + 7 boxes checked.

**The app is ready to hand to real volunteers.** Post-launch follow-ups (admin workflows, GDPR delete, custom Supabase Auth domain, RLS on if Realtime lands, Playwright) live in `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §11.
