# Production Launch Plan

High-level task list for moving from single-file prototype to production app with a Python FastAPI backend.

## Phase 1 — Build system + modules
- [x] Migrate frontend to Vite
- [x] Split `app.jsx` into per-component files
- [x] Add TypeScript; derive types from existing mock data shapes
- [x] Format with Prettier

## Phase 2 — API contract first
See the [design spec](superpowers/specs/2026-04-19-api-contract-design.md).

- [x] Define Pydantic models under `backend/src/backend/contract/` (User, Task, Team, Rank, Rewards, News, auth, form bodies)
- [x] Write endpoint catalog markdown alongside the models
- [x] Validate JSON fixtures against the models via a smoke test (`just contract-validate`)
- [ ] ~~Stub FastAPI endpoints returning mock data server-side~~ — deferred to Phase 5 (runnable server lives with persistence)
- [ ] ~~Validate wire format end-to-end (no persistence yet)~~ — replaced by fixture validation above; end-to-end happens in Phase 4 when the frontend wires up

## Phase 3 — Routing
- [x] Replace `useState("screen")` with React Router or TanStack Router
- [x] Map screens to URLs (`/`, `/home`, `/tasks/:id`, `/me`, etc.)
- [x] Verify bookmarkable URLs and browser back/forward

## Phase 4 — Wire frontend to backend
- [ ] Add TanStack Query for data fetching, cache, loading/error states
- [ ] Replace in-file mock arrays with real fetches

## Phase 5 — Persistence
- [x] Add Postgres via SQLModel
- [x] Set up Alembic migrations
- [ ] Implement CRUD for each resource

## Phase 6 — Auth
- [ ] Decide: Clerk / Supabase Auth vs. roll-your-own Google OAuth
- [ ] Integrate auth provider on frontend
- [ ] Protect FastAPI routes with session/token verification

## Phase 7 — Deploy
- [ ] Deploy frontend (Vercel / Netlify)
- [ ] Deploy backend (Railway / Fly / Render)
- [ ] Provision managed Postgres
- [ ] Configure env vars per environment

## Key tradeoffs
- **Reuse vs. rebuild** — keep components as-is; wrap new architecture around them
- **Auth lift** — Clerk/Supabase = hours; DIY OAuth = ~a week
- **TypeScript timing** — add in Phase 1; retrofitting after Phase 3 is painful

## Tech debt / review findings (pre-Phase-4)

Items surfaced in a 2026-04-20 code review. Address before or during Phase 4 (wire to backend) — once fetch/loading state is threaded through the tree, each of these becomes significantly more painful to refactor. Phase 3 status updates noted per item.

### State architecture
- **`AppStateContext.tsx` holds the whole domain** — all state (`tasks`, `ledTeam`, `joinedTeam`, `successData`) and every handler live in one provider at [`../frontend/src/state/AppStateContext.tsx`](../frontend/src/state/AppStateContext.tsx). Phase 3 replaced `App.tsx` with this provider but didn't split it; every `useAppState()` consumer re-renders on any state change. Split into focused reducers (tasks vs. teams) or a small Zustand store before Phase 4 so per-resource fetch/loading/error slots slot in cleanly instead of bloating this file further.
- **Task-3 "team progress" is double-stored** — [`syncTeamTask` at AppStateContext.tsx:62-83](../frontend/src/state/AppStateContext.tsx#L62) mirrors team membership into `tasks[idx].teamProgress/status/progress`, so the same fact lives in two places. Derive it via a selector from `(ledTeam, joinedTeam, tasks)` instead — one source of truth eliminates an entire class of drift bugs.
- **Setter-inside-setter in `handleProfileComplete`** — [`AppStateContext.tsx:96-134`](../frontend/src/state/AppStateContext.tsx#L96) calls `setLedTeam` and `syncTeamTask` inside the `setUser` updater, which React 18 StrictMode dev invokes twice. Compute `merged` and `myTeam` outside the updater, then call the setters sequentially.

### Mock-data boundaries
- **Hardcoded mock join requests** — the 林詠瑜 / 陳志豪 / 王美玲 pending-request seed lives inside `handleProfileComplete` at [`AppStateContext.tsx:125-127`](../frontend/src/state/AppStateContext.tsx#L125). Move to `data.ts` as a `DEMO_REQUESTS` export, or gate behind `import.meta.env.DEV` so the demo seed doesn't ship to prod.
- **`simulateJoinApproved` is demo-only, runtime-visible** — Phase 3 replaced the `onSimulateJoinApproved` prop with a context method. The call site in `MyScreen` carries an inline `// demo-only` comment. Still needs a build-flag gate (`import.meta.env.DEV`) so the demo button can't fire in prod builds.
- **`RankScreen.tsx` is ~43KB** — almost entirely mock leaderboard + challenge data at roughly [lines 136-870](../frontend/src/screens/RankScreen.tsx#L136). Extract to `src/data/mock-rankings.ts` now; Phase 4 replaces this with fetch calls anyway, and doing the split first makes that diff legible instead of tangled with the fetch migration.
- ~~**`tasksProp || TASKS` fallbacks**~~ — **resolved in Phase 3.** Screens now read `tasks` from `useAppState()`; the prop-drilled fallback is gone.

### Identity
- **`userIdFromEmail`** — [`AppStateContext.tsx:35-45`](../frontend/src/state/AppStateContext.tsx#L35) derives a user id from the email local part (first 4–6 chars uppercased). Collision-prone (e.g. `jet.a@…` and `jet.b@…` collapse to the same id), and that id is then used as the root of the team id (`T-${idSuffix}`), so the collision propagates. Replace with server-issued UUIDs at Phase 4.

## Tech debt / review findings (Phase 3)

Surfaced during Phase 3 (TanStack Router migration). Most items are design trade-offs to revisit in Phase 4 or Phase 6, not bugs.

### Route architecture
- **Flat route tree, not nested layouts** — `/me/profile`, `/me/profile/edit`, `/tasks/:id`, `/tasks/:id/start` are all direct children of `_authed` with full paths, rather than nested children whose parents render an `<Outlet />`. Nested-layout attempts during Phase 3 caused screen-stacking bugs (parent + child rendered simultaneously in the same viewport) and got flattened — see commits `5e93f67` (`/me`), `56f486a` (`/tasks/:id`), and `b8edb22` (`/tasks/:id/start`). If Phase 4 wants shared "me section chrome" or shared loading state across task routes, revisit by giving the parent screens explicit layout responsibilities and an `<Outlet />`.
- **`/me/profile/edit` sentinel is shadowed by the `_authed` guard** — the edit route's `beforeLoad` checks `location.state.fromProfile` and redirects if missing, but for incomplete-profile users the `_authed` guard catches first (→ `/welcome`). Only reachable branch is "complete user, direct URL". Not a bug; worth noting if someone simplifies the guard chain later.
- **`router.invalidate()` on every auth-state change** — [`../frontend/src/main.tsx`](../frontend/src/main.tsx)'s `AppShell` re-evaluates all route guards whenever `user` or `profileComplete` changes. Fine today; Phase 6 (real auth with token refresh) should audit whether invalidation should be more targeted (e.g., invalidate only routes under `_authed`).

### Lint
- **`react-refresh/only-export-components` warnings on route + context modules** — 11 warnings on `src/routes/*.tsx`, `src/state/AppStateContext.tsx`, and `src/test/renderRoute.tsx`, caused by modules exporting both a component and a route object (or a provider + a hook). Low priority. Either disable the rule for `src/routes/**` + `src/state/**` in ESLint config, or split the route object into a sibling `*.route.ts` file and the hook into a sibling `*.hooks.ts`.

### Mixed-script source text
- **Traditional / Simplified Chinese mismatch across UI copy** — `LandingScreen`, `BottomNav`, `RewardsScreen` render Simplified (开启, 首页, 任务, 排行, 我的); `GoogleAuthScreen`, `data.ts` task titles, `ProfileSetupForm` labels render Traditional (選擇帳號, 組隊挑戰, 編輯個人資料). Test assertions had to grep the source per call to know which variant to match. Pick one script for the Chinese UI (likely Simplified given `LandingScreen`/`BottomNav` lead) and sweep the remaining files.

## Tech debt / review findings (Phase 5a)

Surfaced during Phase 5a (backend foundation — FastAPI + SQLModel + Alembic + testcontainers). Address as each becomes actionable in Phase 5b / 5c.

### Async / event-loop plumbing
- **`alembic/env.py` calls `asyncio.run()` at module-import time** — [`backend/alembic/env.py`](../backend/alembic/env.py). Tests sidestep this via `asyncio.to_thread` in [`conftest._alembic_upgrade_head`](../backend/tests/conftest.py). Any future code that imports alembic from a running event loop (e.g. an admin endpoint that triggers migrations) will raise `RuntimeError: asyncio.run() cannot be called when another event loop is running`. Fix: switch `env.py` to a sync Alembic invocation via `engine.sync_engine`.
- **`get_session` has no explicit rollback on exception** — [`backend/src/backend/db/session.py`](../backend/src/backend/db/session.py). Currently relies on SQLAlchemy autobegin/auto-rollback at session close. If a service adds explicit `session.begin()` blocks, wrap the yield in `try/except Exception: await session.rollback(); raise`.

### Schema
- **`TaskProgressRow.form_submission` is `sa.JSON`, not `JSONB`** — [`backend/src/backend/db/models.py`](../backend/src/backend/db/models.py). Store/retrieve works; JSON-path queries (`WHERE form_submission->>'key' = …`) and GIN indexing do not. When a service first needs either, run `ALTER COLUMN form_submission TYPE JSONB USING form_submission::jsonb` in its migration.
- **Python-side `uuid4` + `_utcnow` defaults** — every table in `db/models.py`. No UUID collision risk; `_utcnow` uses the app-server wallclock, so clock skew across replicas can produce non-monotonic `created_at`. Fix for multi-replica: `server_default=sa.func.gen_random_uuid()` / `sa.func.now()`.
- **`TaskProgressRow` has `updated_at` but no `created_at`** — once any update fires, the original enrollment time is lost. Add `created_at` if a service needs to query "when did the user start this task".

### Tooling hygiene
- ~~**Coverage gate temporarily 60%**~~ — resolved in Phase 5b: gate is back to 90 in [`backend/pyproject.toml`](../backend/pyproject.toml) and the auth-layer tests bring total coverage to ~97%.
- **`testcontainers[postgresql]>=4.9` extra is obsolete** — [`backend/pyproject.toml`](../backend/pyproject.toml). testcontainers v4 bundles Postgres support unconditionally; `uv sync` warns `package does not have an extra named 'postgresql'` on every run. Rewrite to `testcontainers>=4.9`.
- **Alembic `path_separator` deprecation warning** — once per pytest run. Fix: add `path_separator = os` under `[alembic]` in [`backend/alembic.ini`](../backend/alembic.ini).

## Tech debt / review findings (Phase 5b)

Surfaced during Phase 5b (Google-stub auth + HS256 JWT + `/auth/google`, `/auth/logout`, `/me`). Address when Phase 6 replaces the Google stub with real JWKS verification, unless noted otherwise.

### Auth / security
- **`display_id` select-then-insert race** — [`backend/src/backend/services/display_id.py`](../backend/src/backend/services/display_id.py) + [`backend/src/backend/services/user.py`](../backend/src/backend/services/user.py). Two concurrent sign-ups with the same email-derived base can both pick the same candidate; the loser hits a unique-constraint `IntegrityError` and the router returns 500. Wrap candidate generation in a retry-on-`IntegrityError` loop, or switch to `INSERT … ON CONFLICT` with suffix regeneration, before production sign-ups land.
- **No JWT revocation / denylist** — `POST /auth/logout` is best-effort: tokens remain valid until `exp` regardless. Combine short access-token TTLs + a refresh-token rotation (or a small per-user revoked-jti table) when this starts mattering.
- **No `iss` / `aud` claims on minted tokens** — [`backend/src/backend/auth/jwt.py`](../backend/src/backend/auth/jwt.py). Single-service HS256 only; revisit if tokens ever cross service boundaries.
- **No rate limiting on `/auth/google`** — a noisy caller can force an unbounded number of upserts + JWT signatures. Add per-IP / per-email throttling at the ingress or a SlowAPI-style middleware.
- **`HTTPException(detail=str(exc))` on `/auth/google`** — [`backend/src/backend/routers/auth.py`](../backend/src/backend/routers/auth.py). Passes through the stub's verbose "Phase 5 stub" message, which also echoes the caller-supplied id_token fragment from `email-validator`. When Phase 6 swaps in real Google verification, replace with a constant `"Invalid id_token"` and log the underlying error server-side at WARNING.

### Dependencies
- **`email-validator` is an undeclared direct dependency** — used by [`backend/src/backend/auth/google_stub.py`](../backend/src/backend/auth/google_stub.py) via the `pydantic[email]` transitive. Pin explicitly in `backend/pyproject.toml` (`"email-validator>=2"`) so a future `pydantic` extra change can't silently break the auth stub.

## Tech debt / review findings (Phase 5c)

Surfaced during Phase 5c (profile completion + teams read/update + full join-request workflow). Address before production sign-ups land or as each route becomes hot; none block Phase 5d (content) or 5e (polish).

### Concurrency / consistency
- **`create_join_request` is non-atomic** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). The 4 conflict checks (self-leader, member-of-this-team, member-of-any-team, has-pending-request) are separate SELECTs before the INSERT. Two concurrent requests by the same user can both pass and both INSERT, violating the at-most-one-pending invariant. Acceptable for single-tenant Phase-5 dev; tighten in Phase 6 with a partial unique index `WHERE status='pending'` on `join_requests(user_id)` + catch `IntegrityError` for a clean 409 retranslate, or wrap the precheck-then-insert in a `SELECT … FOR UPDATE` row lock on the requester's UserRow.

### Performance
- **`row_to_contract_team` N+1** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). Members are batch-loaded but each pending join-request fetches its requester via a separate `session.get(UserRow, …)`. Fine for teams ≤ 10 members; if `GET /teams/{id}` ever becomes hot, batch the requester user loads with one `select(UserRow).where(UserRow.id.in_(…))` the same way members are batched today.
- **Reward-cascade N+1 in `approve_join_request`** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). After approval, the function loops over all members (leader + new + existing) and calls `maybe_grant_challenge_rewards` per user, which itself runs 3-4 SELECTs (challenge defs, led team, led mems, joined link, joined mems, existing reward). For a 6-member team that's roughly 24 queries on a single approval. Acceptable for Phase-5 single-tenant scale; if approval becomes hot, batch the per-user reward check into one query that joins members × challenge defs × existing rewards, or move the cascade to a background job.

### Architecture
- **`services/team.py` is approaching god-module size** — ~347 LOC, 9 public functions across 4 conceptual groups (mapper + search, team lifecycle, join-request workflow, reward cascade). Coherent today but a Phase-6 split candidate: `team/queries.py` (`row_to_contract_team`, `search_team_refs`, `user_to_ref`), `team/lifecycle.py` (`create_led_team`), `team/membership.py` (`JoinConflict` + `create/approve/reject_join_request`, `leave_team`, `maybe_grant_challenge_rewards`).
