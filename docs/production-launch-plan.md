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
- [x] Add TanStack Query for data fetching, cache, loading/error states (Phase 4a)
- [x] Replace in-file mock arrays with real fetches (Phase 4b read-side, Phase 4c write-side)

## Phase 5 — Persistence
- [x] Add Postgres via SQLModel
- [x] Set up Alembic migrations
- [x] Implement CRUD for each resource

See Phase 5 sub-plans:
- [5a Foundation](superpowers/plans/2026-04-19-phase-5a-foundation.md)
- [5b Auth](superpowers/plans/2026-04-19-phase-5b-auth.md)
- [5c Teams](superpowers/plans/2026-04-19-phase-5c-teams.md)
- [5d Content](superpowers/plans/2026-04-19-phase-5d-content.md)
- [5e Polish](superpowers/plans/2026-04-19-phase-5e-polish.md)

Phase 5 ships the persistence layer + runnable backend via five sub-plans:
- **5a Foundation:** FastAPI + SQLModel + Postgres scaffold, `/health`, 11 tables, testcontainers harness.
- **5b Auth:** HS256 JWT + Google ID-token stub, `/auth/google`, `/auth/logout`, `/me`.
- **5c Teams:** profile completion, `/teams/*`, join-request workflow, `/me/teams`.
- **5d Content:** `/tasks/*`, `/me/tasks`, `/me/rewards`, `/rank/{users,teams}`, `/news`.
- **5e Polish:** idempotent dev seed (T1-T4 + 3 news items), `just seed` recipe.

Backend now serves every endpoint listed in `backend/src/backend/contract/endpoints.md`.

## Phase 6 — Auth
- [x] Decide: Clerk / Supabase Auth vs. roll-your-own Google OAuth → Supabase Auth + Supabase Postgres
- [x] Integrate auth provider on frontend (`@supabase/supabase-js`, PKCE flow, `/auth/callback` route)
- [x] Protect FastAPI routes with session/token verification (RS256 JWKS verifier at `backend/src/backend/auth/supabase.py`)
- [x] Post-phase hardening (see "Phase 6 hardening" tech-debt subsection below)

See Phase 6 sub-plans + spec:
- [Design spec (6+7)](superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md)
- [6a Backend auth](superpowers/plans/2026-04-21-phase-6a-backend-auth.md)
- [6b Frontend auth](superpowers/plans/2026-04-21-phase-6b-frontend-auth.md)

Phase 6 replaces the Phase 5b email-stub with real Supabase Auth:
- **6a Backend:** deletes `auth/google_stub.py`, `auth/jwt.py`, `routers/auth.py`, `POST /auth/google`, `POST /auth/logout`. Adds `auth/supabase.py` (RS256 JWKS verifier with `PyJWKClient`), `contract/auth.py::SupabaseClaims`, and rewires `current_user` to verify Supabase JWTs + upsert a `UserRow` on first sight of a `sub`. `UserRow.id` now holds Supabase's `auth.users.id` UUID. Prod-env guard refuses to boot without `SUPABASE_URL`.
- **6b Frontend:** adds `@supabase/supabase-js`, a singleton client with test-override at `src/lib/supabase.ts`, and a `/auth/callback` route that calls `exchangeCodeForSession` (PKCE). `AuthProvider` subscribes to `onAuthStateChange`; `apiFetch` reads the token from Supabase's session. Demo-account chooser deleted; sign-in is one Google button. `frontend/vercel.json` ships CSP + security headers.
- **Hardening (post-6b):** `current_user` retries on `IntegrityError` for the concurrent first-sign-in race; `parseReturnTo` guards route `returnTo` params against open-redirect; `/auth/callback` surfaces exchange errors via toast; `vercel.json` rewrite now includes `/auth/callback` in the SPA fallback; `PyJWKClient` drops `cache_keys=True` so key rotations propagate within the JWKS lifespan.

## Phase 7 — Deploy
- [x] Deploy frontend (Vercel / Netlify)
- [x] Deploy backend (Railway / Fly / Render)
- [x] Provision managed Postgres
- [x] Configure env vars per environment

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

### Identity
- **`userIdFromEmail`** — [`AppStateContext.tsx:35-45`](../frontend/src/state/AppStateContext.tsx#L35) derives a user id from the email local part (first 4–6 chars uppercased). Collision-prone (e.g. `jet.a@…` and `jet.b@…` collapse to the same id), and that id is then used as the root of the team id (`T-${idSuffix}`), so the collision propagates. Replace with server-issued UUIDs at Phase 4.

## Tech debt / review findings (Phase 3)

Surfaced during Phase 3 (TanStack Router migration). Most items are design trade-offs to revisit in Phase 4 or Phase 6, not bugs.

### Route architecture
- **Flat route tree, not nested layouts** — `/me/profile`, `/me/profile/edit`, `/tasks/:id`, `/tasks/:id/start` are all direct children of `_authed` with full paths, rather than nested children whose parents render an `<Outlet />`. Nested-layout attempts during Phase 3 caused screen-stacking bugs (parent + child rendered simultaneously in the same viewport) and got flattened — see commits `5e93f67` (`/me`), `56f486a` (`/tasks/:id`), and `b8edb22` (`/tasks/:id/start`). If Phase 4 wants shared "me section chrome" or shared loading state across task routes, revisit by giving the parent screens explicit layout responsibilities and an `<Outlet />`.
- **`/me/profile/edit` sentinel is shadowed by the `_authed` guard** — the edit route's `beforeLoad` checks `location.state.fromProfile` and redirects if missing, but for incomplete-profile users the `_authed` guard catches first (→ `/welcome`). Only reachable branch is "complete user, direct URL". Not a bug; worth noting if someone simplifies the guard chain later.
- **`router.invalidate()` on every auth-state change** — [`../frontend/src/main.tsx`](../frontend/src/main.tsx)'s `AppShell` re-evaluates all route guards whenever `user` or `profileComplete` changes. Fine today; Phase 6 (real auth with token refresh) should audit whether invalidation should be more targeted (e.g., invalidate only routes under `_authed`).

### Lint
- ~~**`react-refresh/only-export-components` warnings on route + context modules** — 11 warnings across `src/routes/*.tsx` (including `__root.tsx`), `src/main.tsx`, `src/state/AppStateContext.tsx`, and `src/test/renderRoute.tsx`, caused by modules exporting both a component and a route object (or a provider + a hook). Low priority. Either disable the rule for `src/routes/**` + `src/state/**` in ESLint config, or split the route object into a sibling `*.route.ts` file and the hook into a sibling `*.hooks.ts`.~~ **Resolved by Phase 4c:** `src/state/` was deleted alongside `AppStateContext`; `renderRoute` dropped `AppStateProvider`; the remaining `routes/**/*.tsx` + `ui/UIStateProvider.tsx` + `auth/session.tsx` co-exports are glob-suppressed in [`frontend/eslint.config.js`](../frontend/eslint.config.js) ([commit `834de9d`](https://github.com/anthropics/)).

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
- **Alembic `path_separator` deprecation warning** — once per pytest run. Fix: add `path_separator = os` under `[alembic]` in [`backend/alembic.ini`](../backend/alembic.ini).

## Tech debt / review findings (Phase 5b)

Surfaced during Phase 5b (Google-stub auth + HS256 JWT + `/auth/google`, `/auth/logout`, `/me`). **Most items below were resolved by Phase 6 when real Supabase Auth replaced the stub**; kept for historical context.

### Auth / security
- **`display_id` select-then-insert race** — [`backend/src/backend/services/display_id.py`](../backend/src/backend/services/display_id.py) + [`backend/src/backend/services/user.py`](../backend/src/backend/services/user.py). Two concurrent sign-ups with the same email-derived base can both pick the same candidate; the loser hits a unique-constraint `IntegrityError`. **Partially resolved in Phase 6 hardening**: `current_user` now catches `IntegrityError`, rolls back, and re-fetches — so concurrent first-sign-in requests for the *same* `sub` (hitting the PK collision) recover gracefully. The inner `display_id` collision between *different* `sub`s with the same email base is still a 500. Fix remains: `INSERT … ON CONFLICT` on `display_id` with suffix regeneration, or retry-on-`IntegrityError` inside `generate_user_display_id`.
- ~~**No JWT revocation / denylist** — `POST /auth/logout` is best-effort: tokens remain valid until `exp` regardless.~~ **Resolved (reassigned) in Phase 6**: Supabase owns access + refresh token lifecycle. Revocation beyond Supabase's signing-key rotation is still deferred — see `docs/functional-requirements/10-deferred-scope.md`.
- ~~**No `iss` / `aud` claims on minted tokens** — [`backend/src/backend/auth/jwt.py`](../backend/src/backend/auth/jwt.py). Single-service HS256 only; revisit if tokens ever cross service boundaries.~~ **Resolved in Phase 6**: the backend no longer mints tokens. Incoming Supabase JWTs carry `iss` and `aud` claims and `verify_supabase_jwt` enforces both.
- ~~**No rate limiting on `/auth/google`** — a noisy caller can force an unbounded number of upserts + JWT signatures.~~ **Resolved (reassigned) in Phase 6**: `/auth/google` is gone. Sign-in traffic hits Supabase Auth, which applies its own rate limits. Additional app-level throttling remains deferred.
- ~~**`HTTPException(detail=str(exc))` on `/auth/google`** — [`backend/src/backend/routers/auth.py`](../backend/src/backend/routers/auth.py).~~ **Resolved in Phase 6**: router deleted. `current_user` returns a constant `"Missing or invalid bearer token"` on any verification failure.

### Dependencies
- ~~**`email-validator` is an undeclared direct dependency** — used by [`backend/src/backend/auth/google_stub.py`](../backend/src/backend/auth/google_stub.py) via the `pydantic[email]` transitive.~~ **Resolved in Phase 6**: `google_stub.py` deleted; `SupabaseClaims.email` uses plain `str` (Supabase has already validated).

## Tech debt / review findings (Phase 5c)

Surfaced during Phase 5c (profile completion + teams read/update + full join-request workflow). Address before production sign-ups land or as each route becomes hot; none block Phase 5d (content) or 5e (polish).

### Concurrency / consistency
- **`create_join_request` is non-atomic** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). The 4 conflict checks (self-leader, member-of-this-team, member-of-any-team, has-pending-request) are separate SELECTs before the INSERT. Two concurrent requests by the same user can both pass and both INSERT, violating the at-most-one-pending invariant. Acceptable for single-tenant Phase-5 dev; tighten in Phase 6 with a partial unique index `WHERE status='pending'` on `join_requests(user_id)` + catch `IntegrityError` for a clean 409 retranslate, or wrap the precheck-then-insert in a `SELECT … FOR UPDATE` row lock on the requester's UserRow.

### Performance
- **`row_to_contract_team` N+1** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). Members are batch-loaded but each pending join-request fetches its requester via a separate `session.get(UserRow, …)`. Fine for teams ≤ 10 members; if `GET /teams/{id}` ever becomes hot, batch the requester user loads with one `select(UserRow).where(UserRow.id.in_(…))` the same way members are batched today.
- **Reward-cascade N+1 in `approve_join_request`** — [`backend/src/backend/services/team.py`](../backend/src/backend/services/team.py). After approval, the function loops over all members (leader + new + existing) and calls `maybe_grant_challenge_rewards` per user, which itself runs 3-4 SELECTs (challenge defs, led team, led mems, joined link, joined mems, existing reward). For a 6-member team that's roughly 24 queries on a single approval. Acceptable for Phase-5 single-tenant scale; if approval becomes hot, batch the per-user reward check into one query that joins members × challenge defs × existing rewards, or move the cascade to a background job.

### Architecture
- **`services/team.py` mapper + lifecycle split is still pending** — the join-request workflow already lives in [`services/team_join.py`](../backend/src/backend/services/team_join.py) (`JoinConflictError`, `create/approve/reject_join_request`, `leave_team`) and the reward cascade sits in [`services/reward.py`](../backend/src/backend/services/reward.py). `services/team.py` is now ~229 LOC but still mixes two groups: mapper + search (`row_to_contract_team`, `search_team_refs`, `user_to_ref`, `caller_team_totals`) and team lifecycle (`create_led_team`). Phase-6 candidate: split into `team/queries.py` + `team/lifecycle.py` if either grows further.

## Tech debt / review findings (Phase 5d)

Surfaced during Phase 5d (tasks, submissions, rewards, leaderboards, news feed). Address before production traffic or as each route becomes hot; none block Phase 5e (polish).

### Performance
- **`leaderboard_users` / `leaderboard_teams` load every user/team into Python** — [`backend/src/backend/services/rank.py`](../backend/src/backend/services/rank.py). Both functions run `select(UserRow)` / `select(TeamRow)` unfiltered, sort by `(points DESC, id ASC)` in Python, then slice by cursor. Fine at Phase-5 dev scale; the module docstring has an explicit `TODO(phase-6)` pointing at the rewrite — a single SQL with `ROW_NUMBER() OVER (ORDER BY points DESC, id ASC)` projected as `rank`, keyset-paginated via `services.pagination.paginate_keyset` over `(points DESC, id ASC)`. Scales to 10k+ rows without loading the full roster per request.
- **`list_caller_tasks` still fans out `_required_ids` / `_steps_for` / per-task progress lookups** — [`backend/src/backend/services/task.py`](../backend/src/backend/services/task.py). Phase 5d hoists the caller's `completed_ids` out of the per-task loop, but the remaining helpers still run once per def. For 4 seed tasks that's roughly 4 × (requires + 2×steps + progress) ≈ 16 SELECTs on `GET /me/tasks`. Batch each helper across the full def list (one `select(...).where(task_def_id.in_(ids))` per helper) when the endpoint becomes hot or the def count grows past a few dozen.

### Concurrency / consistency
- **`submit_task` has a check-then-insert race** — [`backend/src/backend/services/task.py`](../backend/src/backend/services/task.py). Two concurrent POSTs to the same `(user, task_def)` pair can both see `existing is None` and both attempt to INSERT a `TaskProgressRow`; the `uq_progress_user_task` constraint catches the loser but the raw `IntegrityError` surfaces as HTTP 500 instead of 409. Same pattern as the Phase-5c `create_join_request` item — catch `IntegrityError` on INSERT and retranslate to `TaskSubmitError(409, "Task already completed")`, mirroring what `maybe_grant_challenge_rewards` now does for the reward path via `ON CONFLICT DO NOTHING`.

### Feature gaps
- **No reward-claim transition** — `Reward.status` declares both `"earned"` and `"claimed"` states, but no endpoint moves rows out of `"earned"`. The frontend prototype has no claim flow; the column is wired so Phase 6+ can add `POST /rewards/{id}/claim` (plus whatever fulfillment integration is real by then) without a schema change.
- **News has no admin publish path** — [`backend/src/backend/routers/news.py`](../backend/src/backend/routers/news.py) exposes only `GET /news`; rows must be inserted directly via DB or a migration seed. When editorial workflow becomes real, add an admin-guarded `POST /news` + `PATCH /news/{id}` (the role system itself is TBD; whatever Phase 6 auth settles on needs an admin flag).

## Tech debt / review findings (Phase 5e)

Surfaced during Phase 5e (idempotent dev seed + Phase 5 closeout). The seed items are all "intentional for dev seed" per the 5e plan's self-review; revisit at production hardening. The flaky JWT test is pre-existing — tracked here because it surfaced during the 5e final review.

### Concurrency / consistency
- **Seed is not race-safe** — [`backend/src/backend/seed.py`](../backend/src/backend/seed.py). Two concurrent `just seed` invocations can both pass the `select(TaskDefRow)` / `select(NewsItemRow)` existence check and both INSERT; the loser hits a unique-constraint `IntegrityError`. The module docstring admits this explicitly; acceptable for a dev seed. If seed ever runs at deploy time across replicas, switch the upserts to `INSERT … ON CONFLICT DO NOTHING` or wrap them in `try/except IntegrityError: await session.rollback()`.

### Tooling hygiene
- **Seed is skip-on-conflict only; no force-refresh path** — [`backend/src/backend/seed.py`](../backend/src/backend/seed.py). Operators who change seed content (e.g., edit a T2 title) must `TRUNCATE` the affected tables manually to pick up the change — running `just seed` again is a no-op because the natural keys (`display_id` / `title`) already exist. Consider a `just seed-reset` recipe that truncates the seed tables + re-seeds, gated on `APP_ENV != "production"` so it can't wipe a prod DB.
- **Seed bypasses `services.display_id`; no drift guard** — [`backend/src/backend/seed.py`](../backend/src/backend/seed.py). T1-T4 `display_id` values are hard-coded to match the current validator shape. If [`services/display_id.py`](../backend/src/backend/services/display_id.py) ever tightens its rules (e.g., requires 3-digit suffixes like `T001`), the seed will silently continue emitting `T1` / `T2` / etc. Add a unit test that re-validates every seeded `display_id` through the current validator, or accept the coupling.

### Testing
- **`tests/test_jwt.py::test_decode_rejects_tampered_token` is flaky (~10%)** — [`backend/tests/test_jwt.py`](../backend/tests/test_jwt.py). Pre-existing on `main`; surfaced during the Phase 5e final review with 2/20 runs failing on an otherwise-clean `main`. The test flips one base64url character of the signature segment; when the flipped char decodes to the same byte value, HMAC verification still passes. Fix: flip every char in the signature segment, or base64url-decode the signature first and mutate a middle byte.

## Tech debt / review findings (Phase 4a)

Surfaced during Phase 4a (plumbing — TanStack Query v5, MSW v2, generated OpenAPI types, per-resource API modules, query/mutation factories, `UIStateProvider`, `AuthProvider` scaffolding; backend `DEMO_USERS` seed + γ-fanout join-requests + `seed-reset` + `gen-demo-accounts`). Scope was deliberately plumbing-only: no `useAppState()` callsite changed (count 36 = 36 vs. `main`). Items below are for plans 4b / 4c and production hardening.

### Plan fidelity
- **The 4a plan doc has stale API references** — [`superpowers/plans/2026-04-20-phase-4a-plumbing.md`](superpowers/plans/2026-04-20-phase-4a-plumbing.md). §A1/A2 reference `user_service.get_or_create_by_email`, `user_service.complete_profile`, and `team_service.create_join_request` — none of which exist. Real code: `services.user.upsert_user_by_email` and `services.team_join.create_join_request(session, *, team, requester)`; the seed inlines the profile-completion logic to mirror `routers/me.py::complete_profile`. §A5's `TRUNCATE task_def, news_item, users` had to become `TRUNCATE task_defs, news_items, users` (plural `__tablename__` values). The test sketches in §A1–A3 assume a `session_factory` pytest fixture that [`backend/tests/conftest.py`](../backend/tests/conftest.py) doesn't expose — implementers adapted to the session-scoped `engine` fixture with a local `_truncate_all(engine)` helper. Update the plan before any future replay.
- **`pnpm -C frontend dlx` writes to the wrong cwd** — [`justfile`](../justfile). `-C frontend` switches pnpm's project context but not the CLI's output-path resolution, so `-o src/api/schema.d.ts` originally landed at repo root instead of `frontend/`. Fixed via `cd frontend && pnpm dlx ...` in commit `fcc9537`. Worth checking future pnpm CLI invocations for the same trap.

### Auth / 401 wiring
- ~~**`setSessionExpiredHandler` is registered at module import time in `session.tsx`**~~ **Resolved in Phase 4c + Phase 6**: handler now routes through `signOut({reason: "expired", returnTo})`, which calls `supabase.auth.signOut()`, pushes the toast, navigates via the module-level router ref, and clears the query cache — all inside the `inFlightSignOut` guard.
- ~~**`signOut(opts.returnTo)` is accepted but ignored**~~ **Resolved in Phase 4c**: router-navigate wired; Phase 6 hardening added `parseReturnTo` scrubbing so the value can't carry an open-redirect payload.
- ~~**No E2E 401 test yet**~~ **Resolved in Phase 4c**: `api/__tests__/client.test.ts` covers the full loader-401 → signOut → redirect flow.
- ~~**`signIn(email)` passes the email as `id_token`**~~ **Resolved in Phase 6b**: `signIn` now calls `supabase.auth.signInWithOAuth({ provider: "google" })`; `GoogleAuthScreen` is a single branded button.

### Frontend API layer
- **`apiFetch` always sends `Content-Type: application/json`, even on GETs and empty-body POSTs** — [`../frontend/src/api/client.ts`](../frontend/src/api/client.ts). FastAPI tolerates it; semantically wrong and may trip odd CORS preflights or proxies. Gate on `init.body != null` when tightening.
- **Query-key prefix collision to watch** — [`../frontend/src/queries/keys.ts`](../frontend/src/queries/keys.ts). `qk.task(id)` is `["tasks", id]` (plural prefix) and `qk.myTasks` is `["me", "tasks"]`. Invalidating the bare `["tasks"]` clears `qk.task(*)` but **not** `qk.myTasks`. Mutations in `mutations/tasks.ts` correctly invalidate both; any mutation 4b/4c adds must do the same.
- **Default-invalidate maps in `mutations/*.ts` are deliberately conservative** — e.g. `useApproveJoinRequest` invalidates 6 keys including `["rank"]`. Plan 4c layers optimistic patches and should scope these down per-mutation.
- **`RankPeriod` is inlined in the generated schema** — [`../frontend/src/api/schema.d.ts`](../frontend/src/api/schema.d.ts) emits `"week" | "month" | "all_time"` per operation rather than a named schema. [`../frontend/src/api/rank.ts`](../frontend/src/api/rank.ts) defines a local union to compensate. Backend contract could expose it as a named `RankPeriod` enum (one-liner in [`../backend/src/backend/contract`](../backend/src/backend/contract)) to remove the drift.
- **`Paginated<T>` is hand-rolled in TS**, not imported from the schema — the generator emits monomorphised variants (`Paginated_NewsItem_`, `Paginated_TeamRef_`, etc.) with `next_cursor?: string | null` (optional); the hand-rolled type uses required-nullable. Both are structurally compatible with real responses; prefer the generated variants if a future refactor wants strictness.

### Testing
- **Node 25's experimental `localStorage` global shadows jsdom's and lacks the standard Storage methods** — [`../frontend/src/test/setup.ts`](../frontend/src/test/setup.ts). A 35-line shim feature-tests for `getItem` and installs a `Map`-backed Storage on both `window` and `globalThis` when the native one is broken. Load-bearing for every frontend test that touches `localStorage` (directly or via `tokenStore`). The feature-test auto-skips the shim once Node's API matures or jsdom is upgraded to handle this.
- **MSW is configured with `onUnhandledRequest: "error"`** — [`../frontend/src/test/setup.ts`](../frontend/src/test/setup.ts). Any new endpoint a test hits without a default handler in [`../frontend/src/test/msw/handlers.ts`](../frontend/src/test/msw/handlers.ts) or a per-test `server.use(...)` override fails loudly. Intentional — every new endpoint in 4b/4c needs an MSW entry.
- **MSW fixtures are deliberately minimal** — [`../frontend/src/test/msw/fixtures.ts`](../frontend/src/test/msw/fixtures.ts). One task, empty `rewardsList` / `newsList`, one team. Screens needing variety should extend per-test via `server.use(...)` rather than balloon the canonical fixture.
- **`_truncate_all(engine)` helper duplicated across backend seed tests** — [`../backend/tests/test_seed_demo.py`](../backend/tests/test_seed_demo.py) and [`../backend/tests/test_seed_display_id_drift.py`](../backend/tests/test_seed_display_id_drift.py) both inline the same `TRUNCATE ... CASCADE` helper derived from `SQLModel.metadata.sorted_tables`. When 4b/4c add seed tests, factor into [`../backend/tests/conftest.py`](../backend/tests/conftest.py) instead of adding a third copy.
- **No unit tests on `seed_reset.py` or `dump_demo_accounts.py`** — [`../backend/src/backend/seed_reset.py`](../backend/src/backend/seed_reset.py), [`../backend/src/backend/scripts/dump_demo_accounts.py`](../backend/src/backend/scripts/dump_demo_accounts.py). Both at 0% coverage. Drift-guard tests transitively prove part of the path; a ~10-line test for `render_label` + the `APP_ENV=prod` refusal branch would push coverage closer to 96%.

### Tooling hygiene
- **`just gen-types` must run before `pnpm -C frontend build`** — [`../justfile`](../justfile). `frontend/src/api/schema.d.ts` is gitignored and regenerates deterministically from the backend's OpenAPI. CI must run the recipe before any typecheck/build step; no commit needed.
- **Ruff auto-fix drift accumulates across `just ci` runs** — two chore commits landed in 4a (`eeabe49`, `c14f771`) that only collapsed line wraps / reordered imports. Expected to surface again on future CI runs against `main`. Keep committing as `chore: ruff auto-fixes` to keep PR diffs readable, or wire a pre-commit hook.
- **`just seed-reset` not live-smoke-tested** — [`../backend/src/backend/seed_reset.py`](../backend/src/backend/seed_reset.py). Docker wasn't available in the 4a sandbox so the import was verified but `just seed-reset && just seed` end-to-end wasn't run. Exercise locally before 4b depends on it.

### Feature gaps
- **`Task.display_id` has no contract regex** — [`../backend/src/backend/contract/task.py`](../backend/src/backend/contract/task.py). Declares `display_id: str` with no `Field(pattern=...)` while `User` and `Team` both have one. Phase 4a's drift guard ([`../backend/tests/test_seed_display_id_drift.py`](../backend/tests/test_seed_display_id_drift.py)) pins the current shape `^T[0-9A-Z]+$` locally but this doesn't round-trip against a real contract. Add `Field(pattern=r"^T[0-9A-Z]+$")` to close the loop.

### Scope held for 4b / 4c
- **`frontend/src/state/AppStateContext.tsx` is still wired into every screen** — 4a touched zero `useAppState()` callsites (count locked at 36 vs. `main`). Plan 4b migrates read-side; plan 4c migrates write-side + deletes the context.
- **`frontend/src/types.ts` not touched** — plan 4b owns the snake_case rename + deletion alongside the screen migrations.
- **`_authed` route still reads `context.auth.user`** — plan 4b switches it to `tokenStore`.
- **Optimistic mutation patches not wired** — plan 4c layers them on top of the default-invalidate scaffolding in `mutations/*.ts`.

## Tech debt / review findings (Phase 4b)

Surfaced during Phase 4b (auth guards on `tokenStore` + read-side TanStack Query migration + camelCase→snake_case rename + types.ts/data.ts deletion). Most items are workarounds plan 4c removes; a few are deliberate UX changes.

### Router / navigation workarounds (revisit in 4c)
- **`setRouterRef` still not wired** — [`frontend/src/auth/session.tsx`](../frontend/src/auth/session.tsx)'s session-expired handler and `signOut()` clear token + cache but don't navigate. 4b compensates with explicit `navigate({ to: "/" })` after `signOut()` in `HomeScreen` and `MyScreen`, and `navigate({ to: search.returnTo ?? "/" })` after `signIn()` in [`routes/sign-in.tsx`](../frontend/src/routes/sign-in.tsx). Plan 4c's `_setActiveRouter(router)` + routing 401/logout through `signOut` collapses these call-sites back down.
- **`routing.test.tsx` skips the sign-out redirect case** — `it.skip("signing out while on /home redirects to /sign-in", ...)` with a `TODO(plan 4c)` note. Un-skip once router.navigate is wired.

### Deliberate scope changes
- **`fromDetail` guard on `/tasks/$taskId/start` dropped** — the plan's B4 skeleton replaces the old `redirect if !location.state.fromDetail` check with a `notFound()` when `display_id` isn't in `{T1,T2,T3}`. Cold-loading a form URL now renders the form directly; acceptable since `form_type` gates which form we dispatch.
- **`SUPPORTED_TASK_DISPLAY_IDS` is hardcoded `{T1,T2,T3}`** — [`routes/_authed.tasks.$taskId.start.tsx`](../frontend/src/routes/_authed.tasks.$taskId.start.tsx). Mirrors the current seed. If challenge defs grow past T3, update this set in lockstep (or derive it from `form_type != null || is_challenge`).
- **"Challenge" rank tab is an empty state** — [`screens/RankScreen.tsx`](../frontend/src/screens/RankScreen.tsx) shows "即將推出" because no `/rank/challenges` endpoint exists. Revisit when that endpoint ships.
- **`MyRewards` demo `history` array removed** — [`screens/MyRewards.tsx`](../frontend/src/screens/MyRewards.tsx) now renders from `useMyRewards()`. Empty seed yields an empty state. The old hardcoded 7-entry demo list is gone for good.

### Held for plan 4c
- **`ProfileSetupForm` still uses camelCase internals** — [`screens/ProfileSetupForm.tsx`](../frontend/src/screens/ProfileSetupForm.tsx) keeps `zhName`/`enName`/`phoneCode`/… as local state + a `ProfileInput` shape. [`routes/welcome.tsx`](../frontend/src/routes/welcome.tsx) and [`routes/_authed.me.profile.edit.tsx`](../frontend/src/routes/_authed.me.profile.edit.tsx) adapt `me.zh_name → formUser.zhName` on the way in. Plan 4c rewrites the form against `ProfileCreate` / `ProfileUpdate` from `schema.d.ts` and wires `onSubmit` to `useCompleteProfile` / `usePatchMe`; the adapters and the local `ProfileInput` alias all go away then.
- **`TeamForm` inline `DEMO_TEAMS`** — [`screens/TeamForm.tsx`](../frontend/src/screens/TeamForm.tsx) replaces the deleted `MOCK_TEAMS` with a local 4-entry demo list; `onSubmit` is now `() => void` (no team payload). Plan 4c swaps for `teamsInfiniteQueryOptions` + `useCreateJoinRequest`.
- **`simulateJoinApproved` button kept but stubbed** — [`screens/MyScreen.tsx`](../frontend/src/screens/MyScreen.tsx) still renders the "▶ 模擬核准" dev toggle; clicking throws via the `AppStateContext` stub. Plan 4c either rewires it to `useApproveJoinRequest` against a seeded pending request or removes it entirely. The pre-Phase-4 note (§"Mock-data boundaries" line 77) about gating the button behind `import.meta.env.DEV` becomes moot at that point.
- **`services.user.complete_profile` extraction** — called out in the 4b plan's own "Out of scope" list; needs to land before 4c wires `ProfileSetupForm → useCompleteProfile` so the seed and the production path exercise one `ProfileCreate`-validated code path.

### Cosmetic / process notes
- **D1+D2+D3 bundled into one commit** (`6370226`) — the `TaskCard` type change (camelCase `task: Task (client)` → snake_case `task: Task (schema)`) cascades to HomeScreen + TasksScreen + TaskDetailScreen. Splitting per the plan's "one screen per commit" would have left a broken intermediate commit. Future migrations with shared-component type changes should expect the same bundling requirement.
- **camelCase grep guard has local-variable false positives** — `grep -rn 'zhName|weekPoints|ledTotal|joinedTotal|isChallenge|...' frontend/src/` returns 6 hits on local variables (`MyScreen.ledTotal/joinedTotal`, `TeamCard.weekPoints`, `RankScreen.isChallenge`, `ProfileSetupForm.zhName`) that are not server fields. Server-field purge is complete; the heuristic over-matches.
- **Manual smoke (F2) not performed in the automated run** — requires live backend (`just -f backend/justfile db-up && migrate && seed-reset && just dev`). Implementer should exercise the 7-screen walkthrough in the plan's F2 before closing out 4b.

## Tech debt / review findings (Phase 4c)

Surfaced during Phase 4c (write-side migration + cleanup — every form/button routed through a real mutation; `AppStateContext` deleted; router-aware `signOut`; end-to-end 401 interceptor test). Items below are either out-of-scope for Phase 4 or only become actionable once later phases expose them.

### Auth / session
- **Token storage in `localStorage`** — still localStorage in Phase 6, now owned by the Supabase SDK (`sb-<ref>-auth-token`). XSS → token theft remains the threat; mitigated by strict CSP (`frontend/vercel.json`) locking `connect-src` to `self + *.supabase.co + *.ingest.sentry.io` and blocking inline scripts. BFF cookie-storage pattern was considered and rejected per the Phase 6-7 design spec §2 (not worth the cost for this threat model).
- ~~**No refresh-token rotation**~~ **Resolved (reassigned) in Phase 6**: Supabase SDK auto-refreshes near expiry. Server-side revocation of an active refresh token is still deferred (see `docs/functional-requirements/10-deferred-scope.md`).

### Optimistic-mutation gaps
- **`qk.team(uuid)` invalidated but never patched optimistically** — [`frontend/src/mutations/teams.ts`](../frontend/src/mutations/teams.ts)'s approve/reject/patch hooks patch only `qk.myTeams.led` because Phase 3/4 has no team-detail route subscriber. When a team-detail deep link ships, extend each `onMutate` to also patch `qk.team(teamId)` when present in the cache.

### Invalidation architecture
- **Default-invalidate map is inlined per-hook, not shared.** Spec §6.1 describes the map as a table; 4a landed the inlined version and 4c's optimistic upgrades layered on top without consolidating. A shared `INVALIDATE_MAP: Record<MutationName, QueryKey[]>` + `onSuccessFactory(name)` would collapse ~40 lines of `qc.invalidateQueries({...})` calls across `mutations/{me,tasks,teams}.ts`, make [`mutations/__tests__/me.test.tsx`](../frontend/src/mutations/__tests__/me.test.tsx)'s table-driven assertion a direct import rather than a hand-maintained duplicate, and give the optimistic-mutation `onSettled` hooks a single source of truth. Low-risk post-4c refactor — no behavior change, just deduplication.

### Error surfacing
- **`useSubmitTask` + `useCreateJoinRequest` have no `onError` default toast** — the approve/reject/patch trio got localized `pushToast` calls in 4c, but submit + join-request failures only surface via `mutation.error`. Spec §6.3 asks for 409-aware copy on both; add a shared `onError` factory when the shared invalidate map (above) lands.

### Demo flow ergonomics
- **Seed reaches at most 3/6 on T3** — completing T3 requires extra manual approvals after the two seeded pending requests clear (spec §7.1). Add a `just seed-extra-team-members` recipe if this becomes a bottleneck for product demos.
- **`TeamForm` still filters a hardcoded 4-team list** — [`frontend/src/screens/TeamForm.tsx`](../frontend/src/screens/TeamForm.tsx) emits `display_id` strings like `T-MING2024` into `useCreateJoinRequest.mutate(...)`; the backend has no matching rows so the real flow 404s. Real `teamsInfiniteQueryOptions` + a search endpoint land post-Phase-4.

### Router ref coupling
- **`setRouterRef` singleton is global** — [`frontend/src/router.ts`](../frontend/src/router.ts). Harmless today (single router per app + vitest isolates module state per file), but a future multi-window / SSR setup would need a per-request router resolver. Document or re-scope then.

### Toast UX
- **Inline toast container in `__root.tsx` is text-only** — minimal colored div with click-to-dismiss. Replace with a real toast component (positioning, fade, auto-dismiss, ARIA live-region tuning) when frontend polish lands.

### signOut in test wrapper
- **`renderRoute` registers the memory router via `setRouterRef` but never unregisters** — [`frontend/src/test/renderRoute.tsx`](../frontend/src/test/renderRoute.tsx). Each test overrides the previous ref; fine because vitest isolates modules per file. If a future test suite needs strict teardown (e.g., asserting no leftover navigation after teardown), add a `setRouterRef(null)` step in setup.ts's `afterEach`.

## Tech debt / review findings (Phase 6 + 6 hardening)

Surfaced during Phase 6 (Supabase auth — 6a backend + 6b frontend) and the subsequent hardening review. Landed fixes are linked to their commits; remaining items feed 7a/7b or are post-launch.

### Landed in 6a/6b
- **Phase 6a backend** — HS256 + stub auth surface deleted, RS256 JWKS verifier wired, `UserRow.id` tied to Supabase `auth.users.id`, test fixtures mint RS256 JWTs through a stubbed JWKS client. `backend/src/backend/auth/supabase.py`, `dependencies.py`, `services/user.py::upsert_user_by_supabase_identity`.
- **Phase 6b frontend** — `@supabase/supabase-js` singleton with test override (`src/lib/supabase.ts`), PKCE callback at `/auth/callback`, `apiFetch` reads session token from Supabase, single-button `GoogleAuthScreen`, demo-account chooser deleted, `vercel.json` CSP + security headers.

### Landed in Phase 6 hardening (follow-up review pass)

All fixes against commit `ea61f36` (Phase 6 merge). Branch: `worktree-phase-6-hardening`.

- **`current_user` retries the concurrent first-sign-in race** — `backend/src/backend/auth/dependencies.py` now catches `IntegrityError` from the upsert, rolls back, and re-fetches. A second request that raced against a fresh signup no longer 500s. Tests added under `tests/routers/test_auth_required.py`.
- **`PyJWKClient` drops `cache_keys=True`** — `backend/src/backend/auth/supabase.py`. Per-kid cache had no TTL, which would have kept accepting tokens signed by a revoked key until worker restart. Removing it routes every lookup through the lifespan-governed JWK-set cache.
- **`returnTo` validator** — new `frontend/src/lib/returnTo.ts::parseReturnTo` rejects protocol-relative (`//evil.com`), absolute (`https://…`), `javascript:…`, backslash-prefixed, and bare-`/` values. Applied in `/auth/callback` and `/sign-in` `validateSearch`. 22 unit tests.
- **`/auth/callback` surfaces errors** — `frontend/src/routes/auth.callback.tsx` now pushes an error toast when `exchangeCodeForSession` fails before navigating to `/sign-in`. Prevents silent spinner → blank-sign-in that the pre-hardening code produced on any first-sign-in failure.
- **`vercel.json` SPA rewrite** — `/auth/callback` folded back into the index.html fallback. The pre-hardening exclusion would have returned 404 on OAuth return in prod.
- **Expanded `/auth/callback` tests** — `frontend/src/routes/__tests__/auth.callback.test.tsx` covers happy path, returnTo honoring, open-redirect stripping, error-toast path. `renderRoute` gained a `configureFake` hook so tests can arm pre-mount fake state.
- **`backend/README.md` refreshed** — dropped stale references to `JWT_SECRET`, `google_stub.py`, `dump_demo_accounts.py`, `gen-demo-accounts`, and the pre-rename `rank` router.

### Still deferred

- **`display_id` SELECT-then-INSERT race** — Phase 5b debt. Phase 6 hardening's `IntegrityError` retry covers the PK collision; the inner `display_id` collision between two *different* `sub`s with the same email base still surfaces as 500. Fix: `INSERT … ON CONFLICT` or retry inside `generate_user_display_id`. Acceptable at launch volume; lands in post-launch hardening alongside the rest of Phase 5b's concurrency items.
- **Stale-email collision** — a Supabase user deleted and recreated gets a new `sub` but might collide on `UserRow.email`'s unique constraint. Not a real user path during alpha — requires manual Supabase admin action. Tracked in `plans/2026-04-21-phase-6a-backend-auth.md` Known Deferrals; current_user's retry does NOT silently swallow this, it re-raises so it's visible.
- **CSP `style-src 'unsafe-inline'`** — deliberately deferred in the Phase 6-7 design spec §11.9. Codebase-wide inline `style={}` makes nonce migration a separate pass. Attack surface: CSS-selector side channels combined with any future XSS. Post-launch item.
- **`schema.d.ts` regeneration in CI** — `frontend/src/api/schema.d.ts` is gitignored. `pnpm exec tsc --noEmit` and `pnpm build` require it. 7a's GitHub Actions must run `just gen-types` before any typecheck/build step.
- **Sentry (backend + frontend)** — scoped for 7b. `auth.callback.tsx`'s error path has a `TODO(phase-7b)` comment flagging the Sentry integration point.
- **Admin / RLS / account-deletion / custom Supabase domain / staging env / load testing / Playwright** — tracked in the Phase 6-7 design spec §11.
