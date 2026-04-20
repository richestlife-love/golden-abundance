# Frontend

React 18 + TypeScript + Vite.

## Running

All recipes are run from the repo root with [`just`](https://github.com/casey/just). Prereqs: `just`, `pnpm`, Node 20+, Docker (for the backend's Postgres), and [`uv`](https://github.com/astral-sh/uv) (used by `gen-types` to load the FastAPI app in-process).

### Daily dev loop

```sh
just dev
```

Boots backend (`:8000`) + frontend (`:5173`) in parallel; Ctrl-C kills both. Vite proxies `/api/*` to the backend, so `fetch('/api/v1/me')` just works. **Requires** the backend DB already up, migrated, and seeded — see the one-time setup below.

### One-time / after-DB-schema-change setup

```sh
just -f backend/justfile db-up        # docker compose up Postgres
just -f backend/justfile migrate      # alembic upgrade head
just -f backend/justfile seed-reset   # truncate seed tables + reseed demo users, tasks, news
```

`seed-reset` is refused when `APP_ENV=prod`. Use it (instead of `just -f backend/justfile seed`) when seed *content* has changed — `seed` is idempotent but skip-on-conflict, so it won't update rows that already exist.

### After a backend contract change

```sh
just gen-types            # rewrites src/api/schema.d.ts from the in-process FastAPI OpenAPI
just gen-demo-accounts    # rewrites src/dev/demo-accounts.json from backend.seed.DEMO_USERS
```

`gen-types` runs with no server or DB — it imports the FastAPI app and dumps OpenAPI in-process. `src/api/schema.d.ts` is gitignored; CI must run this before any `tsc`/`vite build` step. `src/dev/demo-accounts.json` is checked in — regenerate and commit after changing `DEMO_USERS`.

### Frontend-only commands

Bypass `just` for quick loops that don't touch the backend:

```sh
pnpm -C frontend dev            # Vite only (no backend; API calls 404 at the proxy)
pnpm -C frontend test           # Vitest run once
pnpm -C frontend test --watch   # Vitest watch mode
pnpm -C frontend build          # tsc -b + vite build (requires src/api/schema.d.ts)
pnpm -C frontend lint           # eslint
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
