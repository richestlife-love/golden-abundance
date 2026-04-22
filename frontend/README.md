# Frontend

React 19 + TypeScript + Vite. See the [root README](../README.md) for prerequisites, recipe tables, and typical workflows.

## API proxy

Vite proxies `/api/*` to the backend (default `http://localhost:8000`, overridable via `VITE_API_BASE_URL`), so client code uses relative paths:

```ts
fetch("/api/v1/me");
```

`just frontend dev` boots Vite only — API calls will 404 at the proxy unless a backend is already running (`just backend dev`). `pnpm build` and `pnpm typecheck` require `src/api/schema.d.ts`; run `just gen-types` from the repo root first.

## Environment

Local overrides live in `frontend/.env.local` (gitignored). Copy `frontend/.env.example` as a starting point. Supported variables:

| Variable                 | Purpose                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Backend origin for the `/api` proxy. Defaults to `http://localhost:8000`.                                                                       |
| `VITE_PORT`              | Dev server port. Defaults to `5173`.                                                                                                            |
| `VITE_ALLOWED_HOSTS`     | Comma-separated hosts for Vite's `allowedHosts` (needed behind a tunnel such as ngrok).                                                         |
| `NGROK_HOST`             | Hostname used by `just frontend tunnel`.                                                                                                        |
| `VITE_SUPABASE_URL`      | Supabase project URL (`https://<ref>.supabase.co`). Required for sign-in to work.                                                               |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public by design). Required for sign-in to work.                                                                             |
| `VITE_SENTRY_DSN`        | Sentry DSN for browser error reporting. Optional — `Sentry.init()` is skipped when absent. Baked into the bundle at build time; safe to expose. |

## pnpm scripts

`just frontend <recipe>` covers the normal loop. The underlying `pnpm` scripts are also available for direct invocation:

| Script                          | Does                                                |
| ------------------------------- | --------------------------------------------------- |
| `pnpm dev`                      | Vite dev server.                                    |
| `pnpm test` / `pnpm test:watch` | Vitest run / watch.                                 |
| `pnpm build`                    | Production bundle (requires `src/api/schema.d.ts`). |
| `pnpm typecheck`                | `tsc --noEmit` (requires `src/api/schema.d.ts`).    |
| `pnpm lint` / `pnpm format`     | ESLint / Prettier.                                  |

## Layout

- `index.html` — Vite entry (loads `/src/main.tsx`)
- `src/main.tsx` — React root with `StrictMode`, `QueryClientProvider`, `AuthProvider`, `UIStateProvider`, and TanStack Router
- `src/api/` — fetch client, per-resource modules, `schema.d.ts` (gitignored — run `just gen-types`)
- `src/auth/` — `AuthProvider`, `signOut()`, Supabase session wiring
- `src/lib/supabase.ts` — Supabase client singleton (PKCE, `detectSessionInUrl: false`) with a test-override hook; `parseReturnTo` in the same folder scrubs URL `returnTo` params for open-redirect safety
- `src/routes/` — TanStack Router route tree (file-per-route, co-exports the route object + component)
- `src/queries/` + `src/mutations/` — TanStack Query options + hooks, one file per resource
- `src/ui/` — shared presentational primitives + `UIStateProvider` (toasts, overlays)
- `src/screens/` — screen/flow components consumed by routes
- `src/assets/` — static images (fingerprinted by Vite)
- `src/test/` — vitest setup + MSW handlers + `renderRoute` + `supabase-mock.ts`
- `vercel.json` — CSP + security headers + SPA rewrite for Vercel deploys

## TypeScript configuration

`tsconfig.json` runs `strict: true` with these deliberate exceptions:

- `noUnusedParameters: false` — React event handlers often accept more params than they use (the event argument, the map index, etc.); forcing unused-parameter errors would be noisy.

Other flags (`strict`, `noUnusedLocals`, `allowJs: false`) are all strict.
