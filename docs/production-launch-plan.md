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
