# Golden Abundance Lite 金富有志工

Monorepo-style layout:

- `frontend/` — React 18 + TypeScript + Vite
- `backend/` — Python FastAPI service
- `docs/` — production launch plan and design specs

## Run

Recipes are organised as a root justfile plus per-subtree justfiles (`backend/justfile`, `frontend/justfile`), wired together with `just` modules. You can invoke recipes two ways:

```sh
# From the repo root — cross-stack recipes and module dispatch
just dev                  # boot backend (:8000) + frontend (:5173) in parallel
just gen-types            # regenerate frontend/src/api/schema.d.ts from FastAPI
just gen-demo-accounts    # regenerate frontend/src/dev/demo-accounts.json
just backend ci           # run backend recipes without cd
just frontend ci          # run frontend recipes without cd
just --list               # list root recipes (subtrees shown as `backend ...` / `frontend ...`)
```

```sh
# Or cd into the subtree and drop the prefix
cd frontend && just ci    # install + lint + format + typecheck + test + bundle
cd backend  && just ci    # install + lint + format + typecheck + test
```

Requires [`just`](https://github.com/casey/just) 1.31+, Node 22+ with [`pnpm`](https://pnpm.io/) 10+ (frontend; dev uses Node 25 via `frontend/.nvmrc`, floor enforced via `engines`), and [`uv`](https://github.com/astral-sh/uv) (backend).

See [`frontend/README.md`](frontend/README.md) for the full dev loop (including one-time DB setup) and TypeScript configuration.
