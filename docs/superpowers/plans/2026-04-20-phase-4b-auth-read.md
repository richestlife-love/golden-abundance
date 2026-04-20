# Phase 4b — Auth + Read-Side Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the new `AuthProvider` + TanStack Query loaders into every read path. After this PR, every screen renders from server data via `useSuspenseQuery` (no `useAppState()` for server-derived state); the `_authed` guard reads from `tokenStore`; all camelCase domain fields are renamed to snake_case; `frontend/src/types.ts` and `frontend/src/data.ts`'s task array are deleted; `/tasks/$taskId` URLs use `display_id` (`T1`/`T2`/`T3`/`T4`) instead of numeric ids.

**Prereqs:** phase-4a-plumbing merged.

**Architecture:** The provider stack changes from `<AppStateProvider>` to `<QueryClientProvider><AuthProvider><UIStateProvider>` (with `<AppStateProvider>` still hosting write-side state until plan 4c). The `_authed` parent route owns auth guards, profile-complete check, and warming the queries every authed child needs (`me`, `myTasks`, `myTeams` per spec §4.3). Each screen migration is one commit: replace `useAppState()` for server-derived state with `useSuspenseQuery(...)` AND rename camelCase fields to snake_case in the same diff (§3.4). `AppStateContext` continues to expose write-side handlers (`completeTask`, `joinTeam`, `approveRequest`, etc.) for now — plan 4c removes those.

**Tech Stack:** Same as 4a. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-20-phase-4-frontend-wiring-design.md`. Sections: §3.3 deletion list; §3.4 cross-cutting (snake_case + display_id URLs + late-bound handlers); §4.1 sign-in flow; §4.3 route guards; §5.4 queryOptions in loaders; §8.2 renderRoute; §9 PR 2.

**Exit criteria:**

- `pnpm -C frontend test` green
- `pnpm -C frontend exec tsc --noEmit` green
- `pnpm -C frontend build` green
- `grep -rn 'zhName\|estMinutes\|weekPoints\|ledTotal\|joinedTotal\|isChallenge\|teamProgress\|TaskProgress\|MockTeam\|MockMember' frontend/src/` returns **zero matches** (camelCase purge complete)
- `grep -rn 'useAppState().tasks\|useAppState().user\|useAppState().ledTeam\|useAppState().joinedTeam' frontend/src/` returns **zero matches** (server-derived state no longer flows through AppStateContext)
- `grep -rn 'TASKS' frontend/src/` only matches the `data.ts` file's existing comments or non-`TASKS`-array references; the `TASKS: Task[]` array export itself is removed
- `frontend/src/types.ts` is deleted
- `taskId: "1" | "2" | "3"` route literals are replaced with `"T1" | "T2" | "T3"`
- Manual smoke (with `just -f backend/justfile db-up && just -f backend/justfile migrate && just -f backend/justfile seed-reset && just dev`):
  - Sign in as `jet@demo.gal` → land on `/home`
  - All four tasks (T1-T4) appear with seeded titles
  - `/me` shows the led team `金杰的團隊`
  - `/leaderboard` shows real (empty) rank tables, no mock data
  - Refreshing any deep link (e.g. `/tasks/T1`) re-loads cleanly via the loader chain

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Provider order in `main.tsx` | `<QueryClientProvider><AuthProvider><AppStateProvider><UIStateProvider><RouterProvider>` | `AuthProvider` needs `QueryClient`; `AppStateProvider` survives this PR for write-side handlers; `UIStateProvider` wraps the routed tree because `successData` overlay is rendered in `__root` |
| `AppStateContext` interim shape | Drop server-derived members (`tasks`, `user`, `ledTeam`, `joinedTeam`, `profileComplete`, `syncTeamTask`, `userIdFromEmail`, `handleSignIn`, `handleSignOut`, hardcoded request seed) but keep write-side handlers as **stubs that throw** until plan 4c rewrites them | Forces every callsite to migrate without a silent fallback path; failed builds catch missed callsites |
| `RouterContext.auth` | Replace with `RouterContext.queryClient` (TanStack Router pattern); guards read `tokenStore` synchronously and `ensureQueryData(meQueryOptions())` for profile_complete | §4.3 |
| Screen migration unit | One screen per commit; each commit must compile and tests must pass | Keeps the diff legible and bisectable |
| Snake_case rename strategy | Rename happens **in the same commit as the screen's data-source migration** | §3.4 explicit — no separate rename pass |
| Loader skeleton UX | `pendingComponent` is a centered spinner div (no skeletons) — Phase 4 ships data correctness, not visual polish | Spec §3 architecture; matches "Phase 5e polish" boundary note |
| `errorComponent` UX | Centered text "載入失敗，請重新整理" with a retry button (`router.invalidate()`) | Minimum viable error UI; richer copy is a Phase-6 polish item |
| `queryClient` instance | One module-level singleton in `main.tsx`, also exposed for tests via `renderRoute` | Standard pattern |
| Display-id resolution for `/tasks/$taskId` | Loader resolves `display_id → uuid` from `myTasks` cache then calls `taskQueryOptions(uuid)` | §3.4 |

---

## File plan

Files created (C), modified (M), or deleted (D) by this plan. Paths relative to repo root.

### Provider stack + router context

| Path | Action | Contents |
|---|---|---|
| `frontend/src/main.tsx` | M | New provider stack; create singleton `queryClient`; mount `<RouterProvider>` with `context: { queryClient }` |
| `frontend/src/router.ts` | M | `createAppRouter` accepts `queryClient` in context; default removed |
| `frontend/src/routes/__root.tsx` | M | `RouterContext = { queryClient: QueryClient }`; remove `useAppState()`-driven `successData` rendering, replace with `useUIState()` |
| `frontend/src/routes/_authed.tsx` | M | `beforeLoad`: `tokenStore.get()` → ensure `meQueryOptions` → check `profile_complete`; `loader`: `ensureQueryData(myTasksQueryOptions)` |
| `frontend/src/routes/sign-in.tsx` | M | `beforeLoad`: if `tokenStore.get()`, ensure `me`, redirect to `/home` or `/welcome`; component reads `useAuth()` instead of `useAppState()` |
| `frontend/src/routes/welcome.tsx` | M | `beforeLoad`: token absent → `/sign-in?returnTo=/welcome`; ensure `me`; `profile_complete` → `/home` |
| `frontend/src/routes/index.tsx` | M | Drop `useAppState()`; redirect logic uses `tokenStore` + cached `me` |
| `frontend/src/routes/_authed.tasks.$taskId.tsx` | M | Loader resolves `display_id → uuid` via `myTasks`; component uses `useSuspenseQuery(taskQueryOptions(uuid))` |
| `frontend/src/routes/_authed.tasks.$taskId.start.tsx` | M | `SUPPORTED_TASK_IDS` → `{"T1","T2","T3"}`; form-dispatch uses `task.form_type` |
| `frontend/src/routes/_authed.me.profile.edit.tsx` | M | Drop `useAppState()`; sentinel check stays |

### Test infrastructure

| Path | Action | Contents |
|---|---|---|
| `frontend/src/test/renderRoute.tsx` | M | Wrap in `QueryClientProvider` + `AuthProvider` + `UIStateProvider`; accept `opts.token` to seed `tokenStore`; existing `seed` API removed |
| `frontend/src/test/queryClient.ts` | C | `makeTestQueryClient()` — fresh client with retry off |

### Screen migrations (one commit per screen)

| Path | Action | Contents |
|---|---|---|
| `frontend/src/screens/HomeScreen.tsx` | M | `useMe()`, `useMyTasks()`; field renames |
| `frontend/src/screens/TasksScreen.tsx` | M | `useMyTasks()`; field renames; navigate by `display_id` |
| `frontend/src/screens/TaskDetailScreen.tsx` | M | Take `Task` from loader / `useSuspenseQuery`; field renames; `requires` becomes `Task[]` filter against `myTasks` |
| `frontend/src/screens/MyScreen.tsx` | M (read parts) | `useMe()`, `useMyTeams()`; field renames; navigate by `display_id`; write-side stays on `useAppState()` stubs (rewritten in 4c) |
| `frontend/src/screens/RewardsScreen.tsx` | M | `useMyRewards()` |
| `frontend/src/screens/MyRewards.tsx` | M | Same |
| `frontend/src/screens/ProfileScreen.tsx` | M | `useMe()`; field renames |
| `frontend/src/screens/RankScreen.tsx` | M | `useInfiniteQuery(rankUsersInfiniteQueryOptions / rankTeamsInfiniteQueryOptions)`; extract inline mock data to `frontend/src/test/msw/fixtures.ts` |

### `AppStateContext` interim trim + helpers

| Path | Action | Contents |
|---|---|---|
| `frontend/src/state/AppStateContext.tsx` | M | Drop `tasks`, `user`, `ledTeam`, `joinedTeam`, `profileComplete`, `syncTeamTask`, `userIdFromEmail`, `handleSignIn`, `handleSignOut`, hardcoded request seed. Keep `successData`/setter (until UIStateProvider takes over fully — already moved? cross-check with 4a). Stubs for write handlers throw "moved to plan 4c" |
| `frontend/src/state/__tests__/AppStateContext.test.tsx` | M | Drop tests for removed members; keep tests for surviving handlers (or delete if empty) |
| `frontend/src/hooks/useMe.ts` | C | `useMe()` returning `{ data, isLoading, ... }` with `useSuspenseQuery(meQueryOptions())` |
| `frontend/src/hooks/useMyTasks.ts` | C | `useMyTasks()` |
| `frontend/src/hooks/useMyTeams.ts` | C | `useMyTeams()` |
| `frontend/src/hooks/useMyRewards.ts` | C | `useMyRewards()` |

### Deletions

| Path | Action | Contents |
|---|---|---|
| `frontend/src/types.ts` | D | All Phase-3 client types — replaced by `components["schemas"][...]` from `schema.d.ts` |
| `frontend/src/data.ts` | M | Remove the `TASKS: Task[]` export. Other constants (e.g. `MOCK_TEAMS`, `MOCK_USERS`, `LEADERBOARD_*`) move to `frontend/src/test/msw/fixtures.ts` |

### Auth screen wire-in

| Path | Action | Contents |
|---|---|---|
| `frontend/src/screens/GoogleAuthScreen.tsx` | M | Replace `onSuccess` prop chain with `useAuth().signIn(email)`; reads `DEMO_ACCOUNTS` from `dev/demo-accounts.ts` |

---

## Section A — Provider stack + router context

**Exit criteria:** `main.tsx` mounts the new provider stack; `RouterContext` carries `queryClient`; the existing routes still compile (guards still pass with the new context shape, even though no screen yet uses `useSuspenseQuery`).

### Task A1: Create the singleton `queryClient`

**Files:**
- Create: `frontend/src/queryClient.ts`

- [ ] **Step 1: Write**

```ts
// frontend/src/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Loaders own the initial fetch; we don't want background refetch
      // storms on every screen mount during dev. Per-query overrides are
      // fine for cases that genuinely want focus refetch.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/queryClient.ts
git commit -m "feat(frontend): module-level queryClient singleton"
```

### Task A2: Update `RouterContext` shape

**Files:**
- Modify: `frontend/src/routes/__root.tsx`
- Modify: `frontend/src/router.ts`

- [ ] **Step 1: Edit `__root.tsx`**

Replace the `RouterContext` interface and remove the `useAppState()` `successData` block. Final file:

```tsx
// frontend/src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import GlobalStyles from "../ui/GlobalStyles";
import FormSuccessOverlay from "../ui/FormSuccessOverlay";
import { useUIState } from "../ui/useUIState";

export interface RouterContext {
  queryClient: QueryClient;
}

function NotFound() {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: 20 }}>找不到页面</h1>
      <p>该路径不存在。</p>
    </div>
  );
}

function RootLayout() {
  const { successData, setSuccessData } = useUIState();
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-shell)",
        fontFamily: "var(--font-sans)",
        overflow: "hidden",
      }}
    >
      <GlobalStyles />
      <Outlet />
      {successData && <FormSuccessOverlay {...successData} onDone={() => setSuccessData(null)} />}
    </div>
  );
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});
```

- [ ] **Step 2: Update `router.ts`**

```ts
// frontend/src/router.ts
import {
  createRouter,
  createBrowserHistory,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { authedRoute } from "./routes/_authed";
import { signInRoute } from "./routes/sign-in";
import { welcomeRoute } from "./routes/welcome";
import { homeRoute } from "./routes/_authed.home";
import { leaderboardRoute } from "./routes/_authed.leaderboard";
import { rewardsRoute } from "./routes/_authed.rewards";
import { tasksRoute } from "./routes/_authed.tasks";
import { taskDetailRoute } from "./routes/_authed.tasks.$taskId";
import { taskStartRoute } from "./routes/_authed.tasks.$taskId.start";
import { meRoute } from "./routes/_authed.me";
import { profileRoute } from "./routes/_authed.me.profile";
import { profileEditRoute } from "./routes/_authed.me.profile.edit";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  authedRoute.addChildren([
    homeRoute,
    tasksRoute,
    taskDetailRoute,
    taskStartRoute,
    leaderboardRoute,
    meRoute,
    profileRoute,
    profileEditRoute,
    rewardsRoute,
  ]),
]);

export function createAppRouter(opts: {
  queryClient: QueryClient;
  history?: RouterHistory;
}) {
  return createRouter({
    routeTree,
    history: opts.history ?? createBrowserHistory(),
    defaultPreload: "intent",
    context: { queryClient: opts.queryClient },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
  interface HistoryState {
    fromDetail?: boolean;
    fromProfile?: boolean;
  }
}

export type AppRouter = AnyRouter;
```

The exported `router` singleton is gone (since `createAppRouter` now requires a `queryClient`); `main.tsx` constructs it. Imports of `router` need to switch to importing the factory.

- [ ] **Step 3: Find and fix `import { router }` usages**

```
grep -rn 'from "../router"\|from "./router"' frontend/src/ | grep -v 'createAppRouter'
```

For each match (likely `main.tsx` and `auth/session.ts`), update the import. `auth/session.ts` was using `router` for navigation in plan 4a's stub — leave that as a `// TODO(plan 4c): wire to router.navigate` comment; navigation itself is wired in 4c.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/__root.tsx frontend/src/router.ts
git commit -m "refactor(frontend): RouterContext carries queryClient (was: auth)"
```

### Task A3: New provider stack in `main.tsx`

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Rewrite `main.tsx`**

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider } from "./state/AppStateContext";
import { AuthProvider } from "./auth/session";
import { UIStateProvider } from "./ui/UIStateProvider";
import { queryClient } from "./queryClient";
import { createAppRouter } from "./router";

const router = createAppRouter({ queryClient });

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <UIStateProvider>
            <RouterProvider router={router} />
          </UIStateProvider>
        </AppStateProvider>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
```

`AppStateProvider` survives the PR — plan 4c removes it. The existing screens that still call `useAppState()` for write-side handlers continue to work.

- [ ] **Step 2: Run typecheck**

```
pnpm -C frontend exec tsc --noEmit
```

Expected: errors about `RouterContext.auth` from any route still using the old shape (likely `_authed.tsx`, `sign-in.tsx`, `welcome.tsx`, `index.tsx`). Those are fixed in Section B.

If `tsc` errors mention `RouterContext.queryClient` missing on guards using `context.auth.user`, that's expected — fix in Section B.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "refactor(frontend): mount QueryClient + Auth + UIState providers"
```

### Task A4: Upgrade `renderRoute` test helper

**Files:**
- Create: `frontend/src/test/queryClient.ts`
- Modify: `frontend/src/test/renderRoute.tsx`

- [ ] **Step 1: Test-only `makeTestQueryClient`**

```ts
// frontend/src/test/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}
```

- [ ] **Step 2: Rewrite `renderRoute`**

```tsx
// frontend/src/test/renderRoute.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { createMemoryHistory } from "@tanstack/react-router";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/session";
import { UIStateProvider } from "../ui/UIStateProvider";
import { tokenStore } from "../auth/token";
import { createAppRouter } from "../router";
import { makeTestQueryClient } from "./queryClient";

export interface RenderRouteOpts {
  /** Pre-seed the bearer token. Test handlers will see "Authorization: Bearer <token>". */
  token?: string;
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
}

export function renderRoute(path: string, opts: RenderRouteOpts = {}): RenderRouteResult {
  if (opts.token) tokenStore.set(opts.token);
  const queryClient = makeTestQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const dom = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIStateProvider>
          <RouterProvider router={router} />
        </UIStateProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { router, dom };
}

export async function expectScreen(
  router: ReturnType<typeof createAppRouter>,
  path: string,
  uniqueText: string | RegExp,
): Promise<void> {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(path);
  });
  await waitFor(() => {
    expect(screen.getByText(uniqueText)).toBeInTheDocument();
  });
}
```

The existing `seed: SeedAuth` parameter and `getState` accessor are gone. Tests that used them migrate to `opts.token` plus MSW handlers that return the relevant fixture from `me`.

- [ ] **Step 3: Find and migrate calling tests**

```
grep -rn 'renderRoute' frontend/src/ | grep test
```

For each test file:
- If it called `renderRoute(path, { seed: "guest" })` → switch to `renderRoute(path)` (no token)
- If `{ seed: "authed-incomplete" }` → `renderRoute(path, { token: "test-token" })` PLUS `server.use(http.get('/api/v1/me', () => HttpResponse.json(f.userIncomplete)))`
- If `{ seed: "authed-complete" }` → `renderRoute(path, { token: "test-token" })` (default `defaultHandlers` already returns `f.userJet` who is complete)
- If it called `result.getState().handleSignIn(...)` etc., migrate the assertion to "POST `/api/v1/auth/google` was called" using a `server.use` spy or rewrite to use `useAuth()` from inside a probe component

Each migrated test commits separately for legibility (no batching).

- [ ] **Step 4: Run the affected tests until green**

```
pnpm -C frontend test
```

Expected: green or test-by-test failures the migration above hasn't covered yet — fix each.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/test
git commit -m "refactor(test): renderRoute uses query/auth/ui providers + token seed"
```

---

## Section B — Route guards on `tokenStore` + `meQueryOptions`

**Exit criteria:** `_authed`, `sign-in`, `welcome`, `/` all read from `tokenStore` + cached `me` per spec §4.3. `useAppState()` is gone from these routes.

### Task B1: `_authed` guard + warm loader

**Files:**
- Modify: `frontend/src/routes/_authed.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// frontend/src/routes/_authed.tsx
import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { tokenStore } from "../auth/token";
import { meQueryOptions, myTasksQueryOptions } from "../queries/me";

export const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: async ({ context, location }) => {
    if (!tokenStore.get()) {
      throw redirect({
        to: "/sign-in",
        search: { returnTo: location.href },
      });
    }
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (!me.profile_complete) {
      throw redirect({ to: "/welcome" });
    }
  },
  loader: async ({ context }) => {
    // Warm so child loaders (display_id → uuid lookups) hit cache.
    await context.queryClient.ensureQueryData(myTasksQueryOptions());
  },
  component: Outlet,
});
```

- [ ] **Step 2: Add `returnTo` to the search-param schema**

TanStack Router needs `search` validation for type safety. Quick approach: add a `validateSearch` to `signInRoute` (covered in Task B2 below); for the `redirect` here, `as never` cast or `search: { returnTo: location.href } as { returnTo: string }` works if validation isn't yet in place.

- [ ] **Step 3: Run typecheck**

```
pnpm -C frontend exec tsc --noEmit
```

Expected: errors limited to the other guard files (sign-in, welcome, index) which still reference `context.auth`. Not from `_authed.tsx`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authed.tsx
git commit -m "refactor(routes): _authed guard reads tokenStore + ensures me/myTasks"
```

### Task B2: `sign-in` guard + `useAuth()` wire-in

**Files:**
- Modify: `frontend/src/routes/sign-in.tsx`

- [ ] **Step 1: Rewrite**

```tsx
// frontend/src/routes/sign-in.tsx
import {
  createRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import GoogleAuthScreen from "../screens/GoogleAuthScreen";
import { useAuth } from "../auth/session";
import { tokenStore } from "../auth/token";
import { meQueryOptions } from "../queries/me";
import { rootRoute } from "./__root";

interface SignInSearch {
  returnTo?: string;
}

function SignInRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/sign-in" });
  const { signIn } = useAuth();
  return (
    <GoogleAuthScreen
      onCancel={() => navigate({ to: "/" })}
      onSelectAccount={async (email) => {
        await signIn(email);
        if (search.returnTo) {
          navigate({ to: search.returnTo });
        }
        // Otherwise the _authed guard / index redirect handles routing.
      }}
    />
  );
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (raw): SignInSearch => ({
    returnTo: typeof raw.returnTo === "string" ? raw.returnTo : undefined,
  }),
  beforeLoad: async ({ context }) => {
    if (!tokenStore.get()) return;
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: SignInRoute,
});
```

The `onSelectAccount` callback shape matches what plan 4b's `GoogleAuthScreen` migration (Task C1) expects.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/sign-in.tsx
git commit -m "refactor(routes): sign-in uses useAuth + returnTo search param"
```

### Task B3: `welcome` and `index` guards

**Files:**
- Modify: `frontend/src/routes/welcome.tsx`
- Modify: `frontend/src/routes/index.tsx`

- [ ] **Step 1: Inspect current shapes**

```
cat frontend/src/routes/welcome.tsx frontend/src/routes/index.tsx
```

These currently read `context.auth.user`. Goal: same logic, sourced from `tokenStore` + cached `me`.

- [ ] **Step 2: Rewrite `welcome.tsx`** — replace any `context.auth.*` access:

```tsx
// frontend/src/routes/welcome.tsx (skeleton — copy current rendering, swap the guard)
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { tokenStore } from "../auth/token";
import { meQueryOptions } from "../queries/me";
// ... existing component imports

// Existing component body unchanged.
// (Drop any useAppState() reads of `user`/`profileComplete`; that data
//  isn't needed in the component itself — only the guard.)

export const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  beforeLoad: async ({ context, location }) => {
    if (!tokenStore.get()) {
      throw redirect({
        to: "/sign-in",
        search: { returnTo: location.href },
      });
    }
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (me.profile_complete) throw redirect({ to: "/home" });
  },
  // component: WelcomeRoute (unchanged from current file)
});
```

If `WelcomeRoute` currently calls `useAppState()` to read `user.email` for the form prefill, replace that with `useMe()` (added in Task D2 — for now, inline `useSuspenseQuery(meQueryOptions())`).

- [ ] **Step 3: Rewrite `index.tsx`** — same pattern. The current redirect logic ("authed → /home; not authed → /") becomes:

```tsx
// frontend/src/routes/index.tsx (skeleton)
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { tokenStore } from "../auth/token";
import { meQueryOptions } from "../queries/me";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    if (!tokenStore.get()) return; // landing page renders
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  // component: existing landing component
});
```

- [ ] **Step 4: Run typecheck**

```
pnpm -C frontend exec tsc --noEmit
```

Expected: zero errors related to `RouterContext.auth`. Any remaining errors are in `routes/_authed.me.profile.edit.tsx` or `routes/_authed.tasks.$taskId.start.tsx` — handled in Task B4.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/welcome.tsx frontend/src/routes/index.tsx
git commit -m "refactor(routes): welcome + index guards read tokenStore + cached me"
```

### Task B4: `_authed.me.profile.edit` and `_authed.tasks.$taskId.start` cleanup

**Files:**
- Modify: `frontend/src/routes/_authed.me.profile.edit.tsx`
- Modify: `frontend/src/routes/_authed.tasks.$taskId.start.tsx`

- [ ] **Step 1: `me.profile.edit.tsx`** — drop `useAppState()` if used purely for `user`; replace with `useMe()` once Task D2 lands. For now, inline `useSuspenseQuery(meQueryOptions())`.

- [ ] **Step 2: `tasks.$taskId.start.tsx`** — switch `SUPPORTED_TASK_IDS` and form-dispatch to `display_id` per spec §3.4. Skeleton:

```tsx
// frontend/src/routes/_authed.tasks.$taskId.start.tsx (skeleton)
import { createRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import InterestForm from "../screens/InterestForm";
import TicketForm from "../screens/TicketForm";
import TeamForm from "../screens/TeamForm";
import { authedRoute } from "./_authed";
import { myTasksQueryOptions } from "../queries/me";
import type { components } from "../api/schema";

type Task = components["schemas"]["Task"];

const SUPPORTED_TASK_DISPLAY_IDS = new Set(["T1", "T2", "T3"]);

function StartRoute() {
  const navigate = useNavigate();
  const { taskId } = taskStartRoute.useParams();
  const { data: tasks } = useSuspenseQuery(myTasksQueryOptions());
  const task = tasks.find((t: Task) => t.display_id === taskId);
  if (!task) {
    throw notFound();
  }
  const goDetail = () =>
    navigate({ to: "/tasks/$taskId", params: { taskId: task.display_id } });

  if (task.form_type === "interest") {
    return <InterestForm onCancel={goDetail} onSubmit={goDetail} />;
  }
  if (task.form_type === "ticket") {
    return <TicketForm onCancel={goDetail} onSubmit={goDetail} />;
  }
  if (task.is_challenge) {
    return <TeamForm onCancel={goDetail} onSubmit={goDetail} />;
  }
  throw notFound();
}

export const taskStartRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId/start",
  beforeLoad: ({ params }) => {
    if (!SUPPORTED_TASK_DISPLAY_IDS.has(params.taskId)) {
      throw notFound();
    }
  },
  component: StartRoute,
});
```

The `onSubmit` callbacks here intentionally don't call `completeTask`/`joinTeam` — that wiring belongs in plan 4c when the mutations land in the form components themselves. For now the form just navigates back.

- [ ] **Step 3: Run, commit**

```
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend test
```

Expected: green. Any test that drove `completeTask` through this route needs an MSW handler for `POST /api/v1/tasks/{id}/submit` returning a default success — add to `defaultHandlers` if multiple tests need it.

```bash
git add frontend/src/routes/_authed.me.profile.edit.tsx frontend/src/routes/_authed.tasks.$taskId.start.tsx
git commit -m "refactor(routes): edit + start routes use useMe / display_id"
```

---

## Section C — `GoogleAuthScreen` wire-in + `useMe` hooks

**Exit criteria:** sign-in flow works end-to-end against MSW (test); `useMe()`, `useMyTasks()`, etc. exist as one-line wrappers.

### Task C1: `GoogleAuthScreen` migration

**Files:**
- Modify: `frontend/src/screens/GoogleAuthScreen.tsx`

- [ ] **Step 1: Inspect the current props**

```
grep -n 'interface\|type\|export default' frontend/src/screens/GoogleAuthScreen.tsx | head
```

The current screen takes `{ onCancel, onSuccess: (raw) => void }` where `raw` is `{email, name, avatar}`. New shape: `{ onCancel, onSelectAccount: (email: string) => Promise<void> }`. The DEMO_ACCOUNTS list replaces whatever inline mock account list the prototype had.

- [ ] **Step 2: Rewrite the screen**

The full rewrite preserves the existing visual, swaps the data source, and changes the callback. Pseudocode skeleton (use the actual layout from the existing file):

```tsx
// frontend/src/screens/GoogleAuthScreen.tsx
import { useState } from "react";
import { DEMO_ACCOUNTS } from "../dev/demo-accounts";

export interface GoogleAuthScreenProps {
  onCancel: () => void;
  onSelectAccount: (email: string) => Promise<void>;
}

export default function GoogleAuthScreen({ onCancel, onSelectAccount }: GoogleAuthScreenProps) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (email: string) => {
    setPending(email);
    setError(null);
    try {
      await onSelectAccount(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
      setPending(null);
    }
  };

  return (
    <div /* preserve existing wrapper styles */>
      {/* preserve existing branding, "選擇帳號" header, etc. */}
      <ul>
        {DEMO_ACCOUNTS.map((acct) => (
          <li key={acct.email}>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => handlePick(acct.email)}
            >
              {acct.label}
            </button>
          </li>
        ))}
      </ul>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={onCancel}>取消</button>
    </div>
  );
}
```

If the existing screen has rich styling for each account row (avatar gradient etc.), keep that — `DEMO_ACCOUNTS` only carries `email + label`, so display whatever's appropriate.

- [ ] **Step 3: Sanity-test the flow with MSW**

The `auth/__tests__/session.test.tsx` test from plan 4a already covers `signIn`. Add a route-level test if useful:

```ts
// frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "../../test/renderRoute";
import { tokenStore } from "../../auth/token";

describe("GoogleAuthScreen via /sign-in", () => {
  it("clicking a demo account signs in and lands on /home", async () => {
    const { router } = renderRoute("/sign-in");
    await waitFor(() => screen.getByRole("button", { name: /金杰/ }));
    fireEvent.click(screen.getByRole("button", { name: /金杰/ }));
    await waitFor(() => expect(tokenStore.get()).toBeTruthy());
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });
});
```

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test src/screens/__tests__/GoogleAuthScreen.test.tsx
```

```bash
git add frontend/src/screens/GoogleAuthScreen.tsx frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx
git commit -m "feat(frontend): GoogleAuthScreen reads DEMO_ACCOUNTS + signIn"
```

### Task C2: `useMe`, `useMyTasks`, `useMyTeams`, `useMyRewards`

**Files:**
- Create: `frontend/src/hooks/useMe.ts`
- Create: `frontend/src/hooks/useMyTasks.ts`
- Create: `frontend/src/hooks/useMyTeams.ts`
- Create: `frontend/src/hooks/useMyRewards.ts`

These are one-line wrappers around `useSuspenseQuery(...QueryOptions())`. They exist purely to give callsites a short import.

- [ ] **Step 1: `useMe.ts`**

```ts
// frontend/src/hooks/useMe.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { meQueryOptions } from "../queries/me";

export function useMe() {
  return useSuspenseQuery(meQueryOptions());
}
```

- [ ] **Step 2: Same shape for the other three**

```ts
// frontend/src/hooks/useMyTasks.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { myTasksQueryOptions } from "../queries/me";
export function useMyTasks() {
  return useSuspenseQuery(myTasksQueryOptions());
}
```

```ts
// frontend/src/hooks/useMyTeams.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { myTeamsQueryOptions } from "../queries/me";
export function useMyTeams() {
  return useSuspenseQuery(myTeamsQueryOptions());
}
```

```ts
// frontend/src/hooks/useMyRewards.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { myRewardsQueryOptions } from "../queries/me";
export function useMyRewards() {
  return useSuspenseQuery(myRewardsQueryOptions());
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks
git commit -m "feat(frontend): useMe/useMyTasks/useMyTeams/useMyRewards hooks"
```

---

## Section D — Screen-by-screen read migration

Each screen migrates in its own commit. The pattern is the same every time:

1. Replace `useAppState()` for server-derived state with `useMe()` / `useMyTasks()` / etc.
2. Rename camelCase fields to snake_case across the file (per spec §3.4).
3. If the screen owns a route, add a `loader` calling `ensureQueryData(...)` and a `pendingComponent` / `errorComponent` to the route file.
4. Run `pnpm -C frontend test` and `pnpm -C frontend exec tsc --noEmit`; both must pass before committing.

**The exact field renames** (do these inside whichever file is being migrated):

| Old (camelCase) | New (snake_case from contract) |
|---|---|
| `task.estMinutes` | `task.est_minutes` |
| `task.teamProgress` | `task.team_progress` |
| `task.isChallenge` | `task.is_challenge` |
| `task.requires` (was `number[]`) | `task.requires` (now `UUID[]`) |
| `task.id` (was `number`) | `task.display_id` (string) for navigation; `task.id` (UUID) for fetches |
| `task.daysLeft` | derive at use site from `task.due_at` |
| `task.due` | `task.due_at` |
| `team.weekPoints` | `team.week_points` |
| `team.currentCount` | derive from `team.members.length + 1` |
| `teamProgress.ledTotal` | `team_progress.led_total` |
| `teamProgress.joinedTotal` | `team_progress.joined_total` |
| `user.zhName` | `user.zh_name` |
| `user.enName` | `user.en_name` |
| `user.phoneCode` | `user.phone_code` |
| `user.lineId` | `user.line_id` |
| `user.telegramId` | `user.telegram_id` |
| `user.avatar` (gradient string) | `user.avatar_url` (URL string) — render fallback if `null` |
| `member.avatar` | `member.avatar_url` |
| `joinRequest.name` | `joinRequest.user.name` |
| `joinRequest.avatar` | `joinRequest.user.avatar_url` |

When the spec says "PR 2 already touches every read-side screen" — every file in this section is one of those touches.

### Task D1: `HomeScreen`

**Files:**
- Modify: `frontend/src/screens/HomeScreen.tsx`
- Modify: `frontend/src/routes/_authed.home.tsx` (if it exists; otherwise skip)

- [ ] **Step 1: Read current screen**

```
sed -n '1,40p' frontend/src/screens/HomeScreen.tsx
```

Identify every `useAppState()` access and every camelCase field reference (use the rename table).

- [ ] **Step 2: Rewrite HomeScreen.tsx**

Replace `const { user, tasks, handleSignOut } = useAppState()` with:

```tsx
import { useMe } from "../hooks/useMe";
import { useMyTasks } from "../hooks/useMyTasks";
import { useAuth } from "../auth/session";

// inside component:
const { data: user } = useMe();
const { data: tasks } = useMyTasks();
const { signOut } = useAuth();
```

Replace each `handleSignOut()` call with `signOut()`. Sweep camelCase fields per the table.

- [ ] **Step 3: Add loader + pendingComponent to the route**

If `_authed.home.tsx` exists:

```tsx
// frontend/src/routes/_authed.home.tsx (additions)
import { myTasksQueryOptions } from "../queries/me";

export const homeRoute = createRoute({
  // ... existing
  loader: ({ context }) => context.queryClient.ensureQueryData(myTasksQueryOptions()),
  pendingComponent: () => <CenteredSpinner />,
  errorComponent: ({ reset }) => <CenteredError onRetry={reset} />,
  component: HomeRoute,
});
```

If `CenteredSpinner` / `CenteredError` aren't built yet, add them as a tiny shared component in `frontend/src/ui/` (one file, ~20 LOC each). Skip if a similar component exists.

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test
pnpm -C frontend exec tsc --noEmit
```

```bash
git add frontend/src/screens/HomeScreen.tsx frontend/src/routes/_authed.home.tsx frontend/src/ui/CenteredSpinner.tsx 2>/dev/null
git commit -m "refactor(frontend): HomeScreen reads useMe/useMyTasks (+ snake_case)"
```

### Task D2: `TasksScreen`

**Files:**
- Modify: `frontend/src/screens/TasksScreen.tsx`
- Modify: `frontend/src/routes/_authed.tasks.tsx`

- [ ] **Step 1: Replace data source**

```tsx
import { useMyTasks } from "../hooks/useMyTasks";
// Inside component:
const { data: tasks } = useMyTasks();
```

- [ ] **Step 2: Update navigation to use display_id**

Anywhere this screen calls `navigate({ to: "/tasks/$taskId", params: { taskId: String(task.id) } })`, switch to:

```tsx
navigate({ to: "/tasks/$taskId", params: { taskId: task.display_id } })
```

- [ ] **Step 3: Field renames per the table**

- [ ] **Step 4: Loader on the route file**

```tsx
loader: ({ context }) => context.queryClient.ensureQueryData(myTasksQueryOptions()),
```

- [ ] **Step 5: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/TasksScreen.tsx frontend/src/routes/_authed.tasks.tsx
git commit -m "refactor(frontend): TasksScreen on useMyTasks (+ display_id nav)"
```

### Task D3: `TaskDetailScreen` + the route loader

**Files:**
- Modify: `frontend/src/screens/TaskDetailScreen.tsx`
- Modify: `frontend/src/routes/_authed.tasks.$taskId.tsx`

- [ ] **Step 1: Rewrite the route loader (display_id → uuid resolution)**

Per spec §3.4 / §5.4:

```tsx
// frontend/src/routes/_authed.tasks.$taskId.tsx
import { createRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import { authedRoute } from "./_authed";
import { myTasksQueryOptions } from "../queries/me";
import { taskQueryOptions } from "../queries/tasks";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type Task = components["schemas"]["Task"];

function TaskDetailRouteComponent() {
  const { taskId: displayId } = taskDetailRoute.useParams();
  const myTasks = useSuspenseQuery(myTasksQueryOptions());
  const summary = myTasks.data.find((t: Task) => t.display_id === displayId);
  if (!summary) throw notFound(); // belt-and-braces; loader already checked
  const { data: task } = useSuspenseQuery(taskQueryOptions(summary.id));
  return <TaskDetailScreen task={task} myTasks={myTasks.data} />;
}

export const taskDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId",
  loader: async ({ params, context }) => {
    await context.queryClient.ensureQueryData(myTasksQueryOptions());
    const list =
      context.queryClient.getQueryData<Task[]>(qk.myTasks) ?? [];
    const task = list.find((t) => t.display_id === params.taskId);
    if (!task) throw notFound();
    await context.queryClient.ensureQueryData(taskQueryOptions(task.id));
  },
  component: TaskDetailRouteComponent,
});
```

- [ ] **Step 2: Migrate `TaskDetailScreen` itself**

The screen previously took `taskId: string` and called `useAppState()` to find the task. Switch to receiving the resolved `task` and `myTasks` as props:

```tsx
// frontend/src/screens/TaskDetailScreen.tsx (signature only)
import type { components } from "../api/schema";
type Task = components["schemas"]["Task"];

interface Props { task: Task; myTasks: Task[]; }
export default function TaskDetailScreen({ task, myTasks }: Props) {
  // ... existing rendering, with field renames per the table.
  // Wherever the old screen looked up `requires` against `tasks`, do the
  // same lookup against `myTasks` using UUIDs (task.requires is UUID[]
  // per the contract).
}
```

The `requires`-driven prerequisites checklist now compares UUIDs against the cached `myTasks`. Display logic stays the same; the lookup key changes.

- [ ] **Step 3: Field renames per the table** — sweep the file.

- [ ] **Step 4: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/TaskDetailScreen.tsx frontend/src/routes/_authed.tasks.$taskId.tsx
git commit -m "refactor(frontend): TaskDetailScreen receives Task (+ display_id resolve)"
```

### Task D4: `MyScreen` (read parts only)

**Files:**
- Modify: `frontend/src/screens/MyScreen.tsx`
- Modify: `frontend/src/routes/_authed.me.tsx`

This screen is large (~800 LOC) and has *both* read state and write actions (approve/reject buttons). In this PR we migrate only the **reads**; the write buttons stay wired to `useAppState()` stubs that throw — plan 4c rewires them to mutations.

- [ ] **Step 1: Replace data sources**

```tsx
import { useMe } from "../hooks/useMe";
import { useMyTeams } from "../hooks/useMyTeams";

// in component:
const { data: user } = useMe();
const { data: myTeams } = useMyTeams();
const ledTeam = myTeams.led;
const joinedTeam = myTeams.joined;
```

- [ ] **Step 2: Field renames per the table**

The two specific lines flagged in the spec:

- `MyScreen.tsx:60` — `params: { taskId: "3" }` → `params: { taskId: "T3" }`
- `MyScreen.tsx:755` — `params: { taskId: "3" }` → `params: { taskId: "T3" }`

Verify with `grep -n 'taskId: "3"' frontend/src/screens/MyScreen.tsx` post-edit and ensure 0 matches.

- [ ] **Step 3: Replace `simulateJoinApproved` button (still gated to dev)**

The current button calls `useAppState().simulateJoinApproved()`. Per spec §3.3 / §7.1, the demo behavior is now a real `POST .../approve` against a seeded request. For this PR (read-side), the button still calls the (now-stub) `useAppState().simulateJoinApproved()` — plan 4c replaces it with a real `useApproveJoinRequest({...})` call.

- [ ] **Step 4: Loader on the route**

```tsx
// frontend/src/routes/_authed.me.tsx (additions)
import { myTeamsQueryOptions } from "../queries/me";
loader: ({ context }) => context.queryClient.ensureQueryData(myTeamsQueryOptions()),
```

- [ ] **Step 5: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/MyScreen.tsx frontend/src/routes/_authed.me.tsx
git commit -m "refactor(frontend): MyScreen reads useMe/useMyTeams (+ T3 display_id)"
```

### Task D5: `RewardsScreen` and `MyRewards`

**Files:**
- Modify: `frontend/src/screens/RewardsScreen.tsx`
- Modify: `frontend/src/screens/MyRewards.tsx`
- Modify: `frontend/src/routes/_authed.rewards.tsx`

- [ ] **Step 1: Replace data source**

```tsx
import { useMyRewards } from "../hooks/useMyRewards";
const { data: rewards } = useMyRewards();
```

- [ ] **Step 2: Field renames** (rewards rarely have camelCase server fields; sanity-check `Reward` schema for `claim_status`, `granted_at`, etc.)

- [ ] **Step 3: Loader**

```tsx
loader: ({ context }) => context.queryClient.ensureQueryData(myRewardsQueryOptions()),
```

- [ ] **Step 4: Commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/RewardsScreen.tsx frontend/src/screens/MyRewards.tsx frontend/src/routes/_authed.rewards.tsx
git commit -m "refactor(frontend): rewards screens on useMyRewards"
```

### Task D6: `RankScreen` (extract mocks; use infinite queries)

**Files:**
- Modify: `frontend/src/screens/RankScreen.tsx`
- Modify: `frontend/src/routes/_authed.leaderboard.tsx`
- Modify: `frontend/src/test/msw/fixtures.ts` (move mock data here)

This is the largest single migration (~1300 LOC source file). The core change is small — read from `useInfiniteQuery` instead of inline arrays. The size comes from sweeping camelCase fields.

- [ ] **Step 1: Identify the mock data exports**

```
grep -n 'const MOCK_\|const LEADERBOARD\|const CHALLENGE' frontend/src/screens/RankScreen.tsx | head
```

These get cut from `RankScreen.tsx` and pasted into `frontend/src/test/msw/fixtures.ts` (only the parts tests actually need; production prefers live data). Anything purely decorative that doesn't appear in tests can be dropped.

- [ ] **Step 2: Replace data sources**

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  rankUsersInfiniteQueryOptions,
  rankTeamsInfiniteQueryOptions,
} from "../queries/rank";

// inside component (period state is already there):
const usersQ = useInfiniteQuery(rankUsersInfiniteQueryOptions(period));
const teamsQ = useInfiniteQuery(rankTeamsInfiniteQueryOptions(period));

const userRows = usersQ.data?.pages.flatMap((p) => p.items) ?? [];
const teamRows = teamsQ.data?.pages.flatMap((p) => p.items) ?? [];
```

- [ ] **Step 3: "Load more" button when `hasNextPage`**

```tsx
{usersQ.hasNextPage && (
  <button onClick={() => usersQ.fetchNextPage()} disabled={usersQ.isFetchingNextPage}>
    載入更多
  </button>
)}
```

- [ ] **Step 4: Field renames per the table** — `weekPoints`, `members.length` (was a number on `MockTeam`), etc. Map `MockTeam` field-by-field to `TeamRankEntry` from the contract.

- [ ] **Step 5: Loader**

```tsx
loader: ({ context }) => Promise.all([
  context.queryClient.ensureInfiniteQueryData(rankUsersInfiniteQueryOptions("week")),
  context.queryClient.ensureInfiniteQueryData(rankTeamsInfiniteQueryOptions("week")),
]),
```

- [ ] **Step 6: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/RankScreen.tsx frontend/src/routes/_authed.leaderboard.tsx frontend/src/test/msw/fixtures.ts
git commit -m "refactor(frontend): RankScreen on useInfiniteQuery (+ extract mocks)"
```

### Task D7: `ProfileScreen`

**Files:**
- Modify: `frontend/src/screens/ProfileScreen.tsx`
- Modify: `frontend/src/routes/_authed.me.profile.tsx`

- [ ] **Step 1: Replace data source**

```tsx
import { useMe } from "../hooks/useMe";
const { data: user } = useMe();
```

- [ ] **Step 2: Field renames per the table** — `zhName`, `enName`, `phoneCode`, `lineId`, `telegramId` are the most common ones.

- [ ] **Step 3: Loader (already warmed by `_authed`, optional)**

- [ ] **Step 4: Commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/ProfileScreen.tsx frontend/src/routes/_authed.me.profile.tsx
git commit -m "refactor(frontend): ProfileScreen on useMe (+ snake_case)"
```

---

## Section E — `AppStateContext` interim trim + dead-code purge

**Exit criteria:** `AppStateContext` no longer exposes `tasks`, `user`, `ledTeam`, `joinedTeam`, `profileComplete`, `handleSignIn`, `handleSignOut`, `successData` (UIStateProvider owns it now), `userIdFromEmail`, `syncTeamTask`, the hardcoded request seed. Write-side handlers (`handleProfileComplete`, `handleProfileUpdate`, `joinTeam`, `leaveLedTeam`, `leaveJoinedTeam`, `approveRequest`, `rejectRequest`, `renameTeam`, `simulateJoinApproved`, `completeTask`) survive as **stubs that throw** "moved to plan 4c". `frontend/src/types.ts` is deleted. `frontend/src/data.ts`'s `TASKS` array is removed.

### Task E1: Trim `AppStateContext.tsx`

**Files:**
- Modify: `frontend/src/state/AppStateContext.tsx`

- [ ] **Step 1: Rewrite to the interim shape**

```tsx
// frontend/src/state/AppStateContext.tsx
import { createContext, useContext, type ReactNode } from "react";

// Phase-4b interim shape: every member is a write-side stub that throws.
// Plan 4c rewrites every callsite to a real useMutation hook and then
// deletes this file entirely.

const NOT_MIGRATED = (name: string): never => {
  throw new Error(
    `${name} is not migrated yet (plan 4c rewires write-side mutations).`,
  );
};

export interface AppState {
  // Write-side handlers, awaiting plan 4c migration to useMutation.
  handleProfileComplete: (...args: unknown[]) => never;
  handleProfileUpdate: (...args: unknown[]) => never;
  joinTeam: (...args: unknown[]) => never;
  leaveLedTeam: (...args: unknown[]) => never;
  leaveJoinedTeam: (...args: unknown[]) => never;
  approveRequest: (...args: unknown[]) => never;
  rejectRequest: (...args: unknown[]) => never;
  renameTeam: (...args: unknown[]) => never;
  simulateJoinApproved: (...args: unknown[]) => never;
  completeTask: (...args: unknown[]) => never;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value: AppState = {
    handleProfileComplete: () => NOT_MIGRATED("handleProfileComplete"),
    handleProfileUpdate: () => NOT_MIGRATED("handleProfileUpdate"),
    joinTeam: () => NOT_MIGRATED("joinTeam"),
    leaveLedTeam: () => NOT_MIGRATED("leaveLedTeam"),
    leaveJoinedTeam: () => NOT_MIGRATED("leaveJoinedTeam"),
    approveRequest: () => NOT_MIGRATED("approveRequest"),
    rejectRequest: () => NOT_MIGRATED("rejectRequest"),
    renameTeam: () => NOT_MIGRATED("renameTeam"),
    simulateJoinApproved: () => NOT_MIGRATED("simulateJoinApproved"),
    completeTask: () => NOT_MIGRATED("completeTask"),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
```

- [ ] **Step 2: Trim `__tests__/AppStateContext.test.tsx`**

```
grep -l useAppState frontend/src/state/__tests__/
```

For every test that exercised a removed member (e.g. `handleSignIn`, `tasks`, `ledTeam`), either delete it (was covered by `auth/__tests__/session.test.tsx`) or rewrite it as a stub-throw assertion. Most likely the entire test file becomes obsolete and is deleted.

- [ ] **Step 3: Run typecheck — every screen that read removed members from `useAppState()` errors here**

```
pnpm -C frontend exec tsc --noEmit
```

For each error: it identifies a screen this PR's earlier sections missed migrating. Migrate the field; commit. Don't move on until typecheck is clean.

- [ ] **Step 4: Run all tests**

```
pnpm -C frontend test
```

If a test calls a stub method and expects it to run (instead of throw), the test belongs in plan 4c — comment it out (or `it.skip(...)`) with `// TODO(plan 4c)`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/state
git commit -m "refactor(frontend): AppStateContext stubs only — server-derived state moved"
```

### Task E2: Delete `frontend/src/types.ts`

**Files:**
- Delete: `frontend/src/types.ts`

- [ ] **Step 1: Verify no remaining imports**

```
grep -rn 'from "../types"\|from "./types"\|from "@/types"' frontend/src/
```

Expected: zero matches. If any remain, those files weren't fully migrated — re-do them per Section D before deleting.

- [ ] **Step 2: Delete**

```bash
git rm frontend/src/types.ts
```

- [ ] **Step 3: Typecheck + commit**

```
pnpm -C frontend exec tsc --noEmit
```

```bash
git add -A
git commit -m "chore(frontend): delete client types.ts (replaced by schema.d.ts)"
```

### Task E3: Trim `frontend/src/data.ts`

**Files:**
- Modify: `frontend/src/data.ts`

- [ ] **Step 1: Read current contents**

```
cat frontend/src/data.ts
```

- [ ] **Step 2: Remove the `TASKS: Task[]` export**

It's no longer imported anywhere (all screens use `useMyTasks()`). If `data.ts` had additional mock arrays still referenced (e.g., `MOCK_USERS` for picker UI), keep them; otherwise the file may end up empty and can be deleted.

- [ ] **Step 3: Verify no `TASKS` imports**

```
grep -rn 'TASKS' frontend/src/
```

Expected: only matches inside `data.ts`'s own definition (if any) and `test/msw/fixtures.ts`'s `tasksList` (different identifier).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data.ts
git commit -m "chore(frontend): drop TASKS mock array from data.ts"
```

---

## Section F — Final verification

**Exit criteria:** every grep guard from "Exit criteria" at the top is green; manual smoke walkthrough completes.

### Task F1: Automated guards

- [ ] **Step 1: camelCase purge check**

```
grep -rn 'zhName\|estMinutes\|weekPoints\|ledTotal\|joinedTotal\|isChallenge\|teamProgress\|TaskProgress\|MockTeam\|MockMember' frontend/src/
```

Expected: zero matches. Any match identifies a missed file.

- [ ] **Step 2: server-state-from-AppStateContext check**

```
grep -rn 'useAppState().tasks\|useAppState().user\|useAppState().ledTeam\|useAppState().joinedTeam' frontend/src/
```

Expected: zero matches.

- [ ] **Step 3: numeric task IDs in routes**

```
grep -rn '"1" | "2" | "3"\|taskId: "[0-9]"' frontend/src/
```

Expected: zero matches. (May find some in test fixtures — ignore those if intentional.)

- [ ] **Step 4: types.ts is gone**

```
test ! -f frontend/src/types.ts && echo OK
```

- [ ] **Step 5: Full test + typecheck + build**

```
pnpm -C frontend test
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend build
```

Expected: all green. The build needs `schema.d.ts` to exist — `just gen-types` first if running on a fresh checkout.

- [ ] **Step 6: Backend still green**

```
just -f backend/justfile ci
```

### Task F2: Manual smoke walkthrough

- [ ] **Step 1: Boot the stack**

```
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile seed-reset
just dev
```

- [ ] **Step 2: Sign in as Jet**

Open `http://localhost:5173/sign-in` → click `金杰 (Jet Kan)` → expect a token in localStorage (`gal.token`) and redirect to `/home`.

- [ ] **Step 3: Verify each screen renders from server data**

| Screen | URL | Expected (seeded values) |
|---|---|---|
| Home | `/home` | Welcome message; T1-T4 cards present |
| Tasks list | `/tasks` | T1-T4 in seeded order, snake_case fields rendered correctly |
| Task detail | `/tasks/T1` | T1 description, est_minutes=5, status="todo", steps from T1 seed |
| Task detail (challenge) | `/tasks/T3` | "組成 6 人團隊", team_progress visible |
| My screen | `/me` | Led team `金杰的團隊`, two pending requests visible (alex, mei) |
| Leaderboard | `/leaderboard` | Empty user/team rank tables (seed has no points yet); no mock placeholders |
| Profile | `/me/profile` | zh_name=金杰, phone=912345678, etc. |
| Rewards | `/rewards` | Empty list (seed has no rewards) |

- [ ] **Step 4: Refresh on a deep link**

Navigate to `/tasks/T1`, refresh the browser. Expected: loader fetches `me` + `myTasks` + `task(uuid)` and the screen renders without flash. If a re-fetch loop appears, suspect `staleTime: 0` somewhere — check `meQueryOptions`, etc.

- [ ] **Step 5: Sign out**

Trigger sign-out (whatever UI exposes it on `MyScreen` or wherever) → token cleared, redirect to `/sign-in` (or `/`). Re-sign-in works.

- [ ] **Step 6: Sign in as Alex (a non-leader demo user)**

Sign out, click `陳志豪 (Alex Chen)` → land on `/home`. Visit `/me` → empty led team, one outgoing pending request against jet visible (per seed §7.1).

- [ ] **Step 7: Commit any documentation updates**

If you noticed copy issues during smoke (field rendered as `[object Object]`, etc.), fix and commit. Otherwise:

```bash
git status
# Should be clean.
```

---

## Out of scope for plan 4b (handled by 4c)

- Wiring `ProfileSetupForm` to `useCompleteProfile` mutation
- `ProfileScreen` edit form to `usePatchMe`
- `TaskDetailScreen` form submit to `useSubmitTask`
- `TeamForm` / `TeamCard` to `useCreateJoinRequest`
- `MyScreen` approve/reject buttons to `useApproveJoinRequest` / `useRejectJoinRequest` (with optimistic patches)
- `RenameTeamSheet` to `usePatchTeam` (optimistic)
- Sign-out button real wiring (`useAuth().signOut()` is already wired in HomeScreen via Task D1; other surfaces follow in 4c)
- Leave-team button to `useLeaveTeam`
- Backend: extract `services.user.complete_profile(session, user, ProfileCreate)` from the inline block in `routers/me.py::complete_profile` so the router and the 4a demo seed share one `ProfileCreate`-validated code path. Prereq for 4c Task B1's `ProfileSetupForm → useCompleteProfile` wire-in if we want the seed + production path to exercise the same validation layer (Phase 4a seed currently duplicates the assignment logic).
- Removing the `simulateJoinApproved` button in favor of a real approve call against a seeded request
- Deleting `AppStateContext.tsx` outright
- 401 interceptor end-to-end test (loader → 401 → router.navigate → toast)
- Removing `react-refresh/only-export-components` warning entries
- Reconciling Phase 3 debt list in `docs/production-launch-plan.md`
