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
- [ ] Replace `useState("screen")` with React Router or TanStack Router
- [ ] Map screens to URLs (`/`, `/home`, `/tasks/:id`, `/me`, etc.)
- [ ] Verify bookmarkable URLs and browser back/forward

## Phase 4 — Wire frontend to backend
- [ ] Add TanStack Query for data fetching, cache, loading/error states
- [ ] Replace in-file mock arrays with real fetches

## Phase 5 — Persistence
- [ ] Add Postgres via SQLModel
- [ ] Set up Alembic migrations
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

Items surfaced in a 2026-04-20 code review. Address before or during Phase 3 (routing) and Phase 4 (wire to backend) — once fetch/loading state is threaded through the tree, each of these becomes significantly more painful to refactor.

### State architecture
- **`App.tsx` god-component** — all domain state (`tasks`, `ledTeam`, `joinedTeam`, `currentTaskId`, `successData`, `rewardsFrom`, `screen`) lives in one file. Split into focused reducers (tasks vs. teams) or a small Zustand store before Phase 4 so per-resource fetch/loading/error slots slot in cleanly instead of bloating this file further. Ref: [`../frontend/src/App.tsx`](../frontend/src/App.tsx).
- **Task-3 "team progress" is double-stored** — [`syncTeamTask` at App.tsx:65-87](../frontend/src/App.tsx#L65) mirrors team membership into `tasks[idx].teamProgress/status/progress`, so the same fact lives in two places. Derive it via a selector from `(ledTeam, joinedTeam, tasks)` instead — one source of truth eliminates an entire class of drift bugs.
- **Setter-inside-setter in `handleProfileComplete`** — [`App.tsx:89-141`](../frontend/src/App.tsx#L89) calls `setLedTeam`, `syncTeamTask`, and `setScreen` inside the `setUser` updater, which React 18 StrictMode dev invokes twice. Compute `merged` and `myTeam` outside the updater, then call the three setters sequentially.

### Mock-data boundaries
- **Hardcoded mock join requests** — the 林詠瑜 / 陳志豪 / 王美玲 pending-request seed lives inside `handleProfileComplete` at [`App.tsx:117-134`](../frontend/src/App.tsx#L117). Move to `data.ts` as a `DEMO_REQUESTS` export, or gate behind `import.meta.env.DEV` so the demo seed doesn't ship to prod.
- **`onSimulateJoinApproved` prop** — threaded through to MyScreen purely for demo flows. Prefix with `_debug` (or strip at build via env flag) so the prop is obviously non-production and doesn't leak into real release builds.
- **`RankScreen.tsx` is ~43KB** — almost entirely mock leaderboard + challenge data at roughly [lines 136-870](../frontend/src/screens/RankScreen.tsx#L136). Extract to `src/data/mock-rankings.ts` now; Phase 4 replaces this with fetch calls anyway, and doing the split first makes that diff legible instead of tangled with the fetch migration.
- **`tasksProp || TASKS` fallbacks** — HomeScreen, TasksScreen, TaskDetailScreen, and TaskCard all fall back to the module-level `TASKS` import when the prop is missing, but App always passes `tasks`. It's dead code that also hides bugs — drop the fallback so any Phase-4 prop-wiring regression surfaces as a visible crash instead of silently rendering stale mock data. Refs: [`../frontend/src/screens/HomeScreen.tsx`](../frontend/src/screens/HomeScreen.tsx), [`../frontend/src/screens/TasksScreen.tsx`](../frontend/src/screens/TasksScreen.tsx), [`../frontend/src/screens/TaskDetailScreen.tsx`](../frontend/src/screens/TaskDetailScreen.tsx), [`../frontend/src/screens/TaskCard.tsx`](../frontend/src/screens/TaskCard.tsx).

### Identity
- **`userIdFromEmail`** — [`App.tsx:47-54`](../frontend/src/App.tsx#L47) derives a user id from the email local part (first 4–6 chars uppercased). Collision-prone (e.g. `jet.a@…` and `jet.b@…` collapse to the same id), and that id is then used as the root of the team id (`T-${idSuffix}`), so the collision propagates. Replace with server-issued UUIDs at Phase 4.
