# Phase 3 — Routing Design

Replace the single `useState<ScreenId>` in `frontend/src/App.tsx` with a real router. URLs become bookmarkable, browser back/forward works, and the route tree becomes the place to hang Phase 4 data loaders and Phase 6 auth guards.

## Goals

- Bookmarkable URLs for every screen a user can meaningfully land on.
- Browser back/forward works correctly across all navigations.
- Auth guards declared once, not per-screen.
- Extract `App.tsx` state into a provider so route components can read it without prop-drilling through `<Outlet>`.
- Leave Phase 4 a clean seam: route loaders will call TanStack Query, auth guards already in the right spot.

## Non-goals

- Zustand or other store migration (Phase 4 prep).
- Replacing mock data with real fetches.
- `RankScreen` mock-data extraction (tech-debt follow-up; out of scope).
- Real user IDs — `userIdFromEmail` stays as-is, replaced in Phase 4.
- Intent-preservation for deep-linked form pages (guest deep-linking to `/tasks/3/start` does not resume the form after sign-in).

## Library

**TanStack Router** (`@tanstack/react-router`), code-based route definitions.

Picked over React Router for tight integration with TanStack Query (Phase 4): route `loaders` write into the same Query cache used by components, giving unified staleness rules and no double-fetch on navigation. Also provides type-safe search params (useful for filtered list screens coming in Phase 4) and a `beforeLoad` + typed `context` mechanism that lets auth guards be declared once on a parent layout route (useful for Phase 6).

History mode: HTML5 (`createBrowserHistory`). Vite dev server and Phase-7 hosts (Vercel/Netlify) handle SPA fallback to `index.html` trivially.

## Route tree

| Path | Screen | Guard |
|---|---|---|
| `/` | `LandingScreen` | none (accessible to everyone, including authed users) |
| `/sign-in` | `GoogleAuthScreen` | authed + complete → `/home`; authed + incomplete → `/welcome` |
| `/welcome` | `ProfileSetupForm` (first-run mode) | not authed → `/sign-in`; complete → `/home` |
| `/home` | `HomeScreen` | `_authed` |
| `/tasks` | `TasksScreen` | `_authed` |
| `/tasks/:taskId` | `TaskDetailScreen` | `_authed` |
| `/tasks/:taskId/start` | `InterestForm` / `TicketForm` / `TeamForm` (dispatched by `taskId`) | `_authed` + cold load (no referrer from detail) → `/tasks/:taskId` |
| `/leaderboard` | `RankScreen` | `_authed` |
| `/me` | `MyScreen` | `_authed` |
| `/me/profile` | `ProfileScreen` | `_authed` |
| `/me/profile/edit` | `ProfileSetupForm` (edit mode) | `_authed`; incomplete profile → `/welcome` |
| `/rewards` | `RewardsScreen` | `_authed` |

**Naming rationale:**
- `/leaderboard` instead of `/rank` — conventional name for this screen type.
- `/tasks/:taskId/start` instead of `/tasks/:taskId/form` — action verb matches the CTA label ("開始任務") and feels native-app-like.
- `/welcome` instead of `/onboarding` — user-facing rather than product-team jargon.
- `/me/profile` nested under `/me` — matches the native-mobile "我" tab information hierarchy (intentional choice over the flatter web convention).

**Layout routes (no URL segment):**
- `__root` — wraps every route. Mounts `<GlobalStyles />` and the `<FormSuccessOverlay />` portal (the overlay must float over any route).
- `_authed` — auth guard only. Children inherit the redirect rules.

## Router context

Typed `context` passed to `createRouter` and refreshed on every `RouterProvider` render:

```ts
interface RouterContext {
  auth: {
    user: User | null;
    profileComplete: boolean; // derived: !!user?.zhName
  };
}
```

Guards read `context.auth` and `throw redirect({ to: ... })` as needed. Because context is re-provided on every parent render, auth-state changes immediately re-evaluate guards.

## Landing CTA

`LandingScreen`'s "開啟" button dispatches based on auth state (read via `useAppState()`):

- Guest → `navigate({ to: '/sign-in' })`
- Authed, profile incomplete → `navigate({ to: '/welcome' })`
- Authed, profile complete → `navigate({ to: '/home' })`

Landing remains accessible to authed users (they can revisit it freely — e.g., to show a friend).

## Form cold-load redirects

`/tasks/:taskId/start` is transition-only: reachable by navigating from `/tasks/:taskId` (task detail) or from `MyScreen`'s "建立隊伍" button. Cold loads redirect to `/tasks/:taskId`.

Implementation: when navigating to the form, set a history-state sentinel (`{ fromDetail: true }`). The route's `beforeLoad` reads `location.state` — if the sentinel is missing, it redirects. Reloading the form page drops the sentinel and also redirects, which is the correct behavior since the form's input state is wiped on reload anyway.

Same rule for `/me/profile/edit`: cold load redirects to `/me/profile`.

## State refactor — scope

Minimum needed to unblock routing. No store migration.

**`App.tsx` is deleted.** Its state and handlers move verbatim into an `AppStateProvider` (React Context).

**New file: `frontend/src/state/AppStateContext.tsx`**

Exposes via `useAppState()`:

```ts
{
  user, setUser,
  tasks,
  ledTeam, joinedTeam,
  currentTaskId,                 // optional after Phase 3 (URL holds taskId), kept for now
  successData, setSuccessData,
  handleSignIn,
  handleProfileComplete,
  handleProfileUpdate,
  handleSignOut,
  joinTeam, leaveLedTeam, leaveJoinedTeam,
  approveRequest, rejectRequest, renameTeam,
  simulateJoinApproved,
  completeTask,
}
```

**`main.tsx` wraps:**
```tsx
<AppStateProvider>
  <RouterProvider router={router} />
</AppStateProvider>
```

**`rewardsFrom` state is deleted.** `RewardsScreen`'s back button uses `router.history.back()` (real browser history). Deep-linking to `/rewards` and tapping back goes wherever the browser history sends you.

**Screens stop receiving domain props.** `<HomeScreen />` reads from `useAppState()` + `useNavigate()` internally. Their presentational innards (layout, styling, event wiring) are unchanged.

**Task-detail routing:** `TaskDetailScreen` reads `taskId` from `useParams()` instead of the `currentTaskId` prop. `currentTaskId` stays in context as a transitional field for `ProfileSetupForm` flows that set it imperatively (e.g., `MyScreen`'s "建立隊伍" button). A later pass can remove it once all entry points navigate directly.

## Known tech debt carried forward (not addressed here)

From `docs/production-launch-plan.md` Phase-3 tech-debt section:

- `App.tsx` god-component — partially dissolved (state moves to provider) but not split by domain. Phase-4 prep can reducer-split or Zustand-ify.
- Task-3 "team progress" double-storage (`syncTeamTask`) — unchanged.
- `handleProfileComplete` setter-inside-setter — unchanged.
- `RankScreen` 43KB mock extraction — unchanged.
- `tasksProp || TASKS` fallbacks in screens — unchanged; screens will read tasks from context instead of props, so the fallback becomes unreachable and can be removed then (minor cleanup, not a refactor).
- `onSimulateJoinApproved` demo prop — exposed on context as `simulateJoinApproved`; tagged as demo-only in a comment.
- Mock join-request seed inside `handleProfileComplete` — unchanged.

## Testing

Add Vitest + Testing Library. Not yet present in the project.

**Dev dependencies:**
- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`

**Config:** `frontend/vitest.config.ts` with `test.environment = 'jsdom'`, `test.globals = true`, `test.setupFiles = ['./src/test/setup.ts']` (imports `@testing-library/jest-dom`).

**Route-level tests** (`frontend/src/routes/__tests__/`):

1. **Landing CTA**
   - Guest → `/` → click "開啟" → navigates to `/sign-in`.
   - Authed incomplete → `/` → click "開啟" → navigates to `/welcome`.
   - Authed complete → `/` → click "開啟" → navigates to `/home`.
2. **Auth guard redirects**
   - Guest visits `/home` → redirect to `/`.
   - Authed incomplete visits `/me` → redirect to `/welcome`.
   - Authed complete visits `/welcome` → redirect to `/home`.
   - Authed complete visits `/sign-in` → redirect to `/home`.
3. **Task routing**
   - `/tasks/3` renders `TaskDetailScreen` for task 3.
   - `/tasks/999` renders not-found route.
   - `/tasks/3/start` cold load → redirects to `/tasks/3`.
   - Navigate `/tasks/3` → "開始任務" button → `/tasks/3/start` renders `TeamForm`.
4. **History behavior**
   - Navigate `/home` → `/tasks` → `/tasks/1` → back → `/tasks` → back → `/home`.

Tests mount the router with an in-memory history and a stubbed `AppStateProvider` value, asserting on rendered text and `router.state.location.pathname`.

**Manual smoke** — Phase-3 completion gate:
- `pnpm dev`, click every bottom-nav button, reload on each route.
- Use browser back/forward across every transition.
- Paste `/tasks/2` directly into a new tab (guest and authed).
- Paste `/tasks/2/start` directly — verify redirect to `/tasks/2`.
- Paste `/rewards` directly — verify back button doesn't crash.

## Dependencies

Added:
- `@tanstack/react-router`
- `@tanstack/react-router-devtools` (dev)
- `vitest` (dev)
- `@testing-library/react` (dev)
- `@testing-library/jest-dom` (dev)
- `jsdom` (dev)

## File-by-file change summary

**New:**
- `frontend/src/router.ts` — `createRouter`, route tree, not-found + error elements.
- `frontend/src/routes/__root.tsx` — layout with `<GlobalStyles />`, `<FormSuccessOverlay />`, `<Outlet />`.
- `frontend/src/routes/_authed.tsx` — auth guard layout.
- `frontend/src/routes/*.tsx` — one file per route in the table above.
- `frontend/src/state/AppStateContext.tsx` — provider + `useAppState()` hook.
- `frontend/src/test/setup.ts` — testing-library setup.
- `frontend/vitest.config.ts` — vitest config.
- `frontend/src/routes/__tests__/*.test.tsx` — route-level tests.

**Modified:**
- `frontend/src/main.tsx` — mount `AppStateProvider` + `RouterProvider`.
- `frontend/src/screens/*.tsx` — drop domain props; read from `useAppState()` + `useNavigate()` / `useParams()`.
- `frontend/src/types.ts` — `ScreenId` removed (routing replaces it).
- `frontend/package.json` — new deps + `test` script (`vitest run`).

**Deleted:**
- `frontend/src/App.tsx` — state moves to `AppStateContext`; render moves to routes.

## Completion criteria

- All 12 current screens reachable via their URL.
- Browser back/forward works across all transitions covered in the manual smoke list.
- Auth guards verified by the route-level tests above.
- `pnpm build` passes with no TS errors.
- `pnpm test` passes.
- `pnpm lint` passes.
- Production launch plan Phase 3 items all checkable.
