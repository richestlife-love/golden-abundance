# Golden Abundance Lite 金富有志工

Monorepo-style layout:

- `frontend/` — React 18 + TypeScript + Vite (Phase 1 split is complete)
- `backend/` — Python FastAPI service (Phase 2 contract module; runtime lands in Phase 5)
- `docs/` — production launch plan and design specs

## Run (frontend)

```sh
just install        # install npm deps under frontend/
just serve          # Vite dev server on http://localhost:8000
just build          # tsc -b && vite build → frontend/dist
just tunnel         # https://subvitalized-occupative-katelyn.ngrok-free.dev
just fmt            # format frontend sources with Prettier
just fmt-check      # verify no drift (exits non-zero if anything needs formatting)
```

Requires [`just`](https://github.com/casey/just) and Node 20+.

## Layout (frontend)

- `index.html` — Vite entry (loads `/src/main.tsx`)
- `src/main.tsx` — React root with StrictMode
- `src/App.tsx` — screen orchestration and app state
- `src/types.ts` — client-side data types (replaced in Phase 4 by contract-generated types)
- `src/data.ts` — mock TASKS / MOCK_TEAMS (MOCK_MEMBERS exported for future use)
- `src/utils.ts` — pure helpers (`getEffectiveStatus`)
- `src/ui/` — 17 shared presentational primitives
- `src/screens/` — 18 screen/flow components
- `src/assets/` — static images (fingerprinted by Vite)
