# Frontend

React 18 + TypeScript + Vite.

## Running

Prereqs: [`just`](https://github.com/casey/just), `pnpm`, Node 20+, Docker (for the backend's Postgres), and [`uv`](https://github.com/astral-sh/uv) (used by `gen-types` to load the FastAPI app in-process).

Recipes are grouped by where you run them from. Cross-stack recipes live at the repo root; backend-only recipes live under `backend/`; frontend-only commands are `pnpm` scripts you run from `frontend/`.

### Daily dev loop — from the repo root

```sh
just dev
```

Boots backend (`:8000`) + frontend (`:5173`) in parallel; Ctrl-C kills both. Vite proxies `/api/*` to the backend, so `fetch('/api/v1/me')` just works. **Requires** the backend DB already up, migrated, and seeded — see the one-time setup below.

### After a backend contract change — from the repo root

```sh
just gen-types            # rewrites frontend/src/api/schema.d.ts from the in-process FastAPI OpenAPI
just gen-demo-accounts    # rewrites frontend/src/dev/demo-accounts.json from backend.seed.DEMO_USERS
```

`gen-types` needs neither a running server nor a DB — it imports the FastAPI app and dumps OpenAPI in-process. `schema.d.ts` is gitignored; CI must run this before any `tsc`/`vite build` step. `demo-accounts.json` is checked in — regenerate and commit after changing `DEMO_USERS`.

### One-time / after-DB-schema-change setup — from `backend/`

```sh
cd backend
just db-up        # docker compose up Postgres
just migrate      # alembic upgrade head
just seed-reset   # truncate seed tables + reseed demo users, tasks, news
```

`seed-reset` is refused when `APP_ENV=prod`. Use it (instead of `just seed`) when seed *content* has changed — `seed` is idempotent but skip-on-conflict, so it won't update rows that already exist. Run `just --list` inside `backend/` to see the full recipe set (`ci`, `test`, `makemigration`, etc.).

### Frontend-only commands — from `frontend/`

For quick loops that don't touch the backend:

```sh
cd frontend
pnpm dev            # Vite only (no backend; API calls 404 at the proxy)
pnpm test           # Vitest run once
pnpm test --watch   # Vitest watch mode
pnpm build          # tsc -b + vite build (requires src/api/schema.d.ts — run `just gen-types` from root first)
pnpm lint           # eslint
```

## Layout

- `index.html` — Vite entry (loads `/src/main.tsx`)
- `src/main.tsx` — React root with StrictMode
- `src/App.tsx` — screen orchestration and app state
- `src/types.ts` — client-side data types (replaced in Phase 4 by contract-generated types)
- `src/data.ts` — mock TASKS / MOCK_TEAMS (MOCK_MEMBERS exported for future use)
- `src/utils.ts` — pure helpers (`getEffectiveStatus`)
- `src/ui/` — 17 shared presentational primitives
- `src/screens/` — 18 screen/flow components
- `src/assets/` — static images (fingerprinted by Vite)

## TypeScript configuration

`tsconfig.json` runs `strict: true` with these deliberate exceptions:

- `noUnusedParameters: false` — React event handlers often accept more params than they use (the event argument, the map index, etc.); forcing unused-parameter errors would be noisy.

Other flags (`strict`, `noUnusedLocals`, `allowJs: false`) are all strict.
