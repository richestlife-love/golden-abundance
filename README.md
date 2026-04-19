# Golden Abundance Lite 金富有志工

Monorepo-style layout:

- `frontend/` — React 18 + TypeScript + Vite (Phase 1 split is complete)
- `backend/` — Python FastAPI service (Phase 2 contract module; runtime lands in Phase 5)
- `docs/` — production launch plan and design specs

## Run

Recipes live per subtree. `cd` into the subtree first, then run:

```sh
cd frontend
just dev            # Vite dev server on http://localhost:5173
just tunnel         # https://subvitalized-occupative-katelyn.ngrok-free.dev
just ci             # install + lint + format + typecheck + bundle
```

```sh
cd backend
just ci                # ruff + ty
just contract-validate # validate JSON fixtures against the Pydantic contract
```

Requires [`just`](https://github.com/casey/just), Node 20+ with [`pnpm`](https://pnpm.io/) (frontend), and [`uv`](https://github.com/astral-sh/uv) (backend).

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

## Blame-friendly commits

Reformat-only commits are listed in `.git-blame-ignore-revs`. Run once per
clone so local `git blame` skips them:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

GitHub's blame UI honours the file automatically — no configuration needed.

## TypeScript configuration

`frontend/tsconfig.json` runs `strict: true` with these deliberate exceptions:

- `noUnusedParameters: false` — React event handlers often accept more params than they use (the event argument, the map index, etc.); forcing unused-parameter errors would be noisy.

Other flags (`strict`, `noUnusedLocals`, `allowJs: false`) are all strict.
