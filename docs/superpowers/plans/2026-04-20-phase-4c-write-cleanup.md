# Phase 4c — Write-Side Migration + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every form submit + action button to the corresponding `useMutation` hook (with optimistic patches for the three flagged in spec §6.2); upgrade `signOut` to navigate via `router` and surface the session-expired toast on `/sign-in` from `?returnTo=...`; delete `AppStateContext.tsx`; remove the demo `simulateJoinApproved` button (replaced by real approve calls against seeded requests); reconcile the Phase 3 debt list in `docs/production-launch-plan.md`; add the end-to-end 401 interceptor test from spec §8.4.

**Prereqs:** phase-4b-auth-read merged.

**Architecture:** Each form/button migration replaces a `useAppState()` stub call with a `useMutation` hook from `frontend/src/mutations/*.ts`. Three mutations get optimistic upgrades (approve/reject join-request + team patch, per spec §6.2) — the optimistic patch goes to `qk.myTeams.led` (not `qk.team(uuid)`), since Phase 3/4 has no team-detail route subscriber. Mutation `onSuccess` callbacks fire `pushSuccess` for celebration overlays (§6.4). The 401 interceptor in `auth/session.ts` upgrades from "drop token + toast" (plan 4a stub) to "drop token + toast + `router.navigate({ to: '/sign-in', search: { returnTo } })`". After all mutations land, `AppStateContext.tsx` is deleted and `<AppStateProvider>` is removed from `main.tsx`.

**Tech Stack:** Same as 4a/4b. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-20-phase-4-frontend-wiring-design.md`. Sections: §3.3 deletion list (`AppStateContext.tsx` final removal); §4.4 401 interceptor (full body with router navigation); §6.1 invalidation map; §6.2 optimistic mutations; §6.3 error surfacing; §6.4 success overlay trigger; §7.1 demo seed (the approve button now hits a real seeded request); §8.4 401 test; §9 PR 3.

**Exit criteria:**

- `pnpm -C frontend test` green, including the new 401 interceptor end-to-end test
- `pnpm -C frontend exec tsc --noEmit` green
- `pnpm -C frontend build` green
- `grep -rn 'useAppState' frontend/src/` returns **zero matches** (every callsite migrated; `AppStateContext.tsx` deleted)
- `grep -rn 'simulateJoinApproved' frontend/src/` returns **zero matches** (button replaced by real approve flow)
- `grep -rn 'AppStateProvider' frontend/src/` returns **zero matches** (provider removed from `main.tsx`)
- `frontend/src/state/` directory is empty (or deleted)
- `react-refresh/only-export-components` ESLint warnings on routes/state modules are gone (lines for deleted modules removed; remaining warnings on surviving route files documented or rule-disabled per §3.4 Phase 3 debt resolution)
- Manual smoke (with `just -f backend/justfile seed-reset && just dev`):
  - Sign in as `jet@demo.gal` → approve `alex@demo.gal`'s pending request → success overlay fires (if T3 reward applies) → team has 2 members + 1 pending request remaining
  - Approve `mei@demo.gal`'s request → 3 members, 0 pending; T3 progress shows 3/6
  - Click rename team → set alias → optimistic update appears instantly, persists after refresh
  - Sign out → land on `/sign-in`; sign back in → land on `/home`
  - Manually clear localStorage `gal.token` mid-session → next fetch fires 401 interceptor → toast appears, redirect to `/sign-in?returnTo=/me`
  - Submit T1 (interest form) → server records completion → reward overlay fires → T1 status flips to `completed` → T2 unlocks
- `docs/production-launch-plan.md` has Phase 4 marked complete and Phase 3 debt items resolved-by-Phase-4 crossed out

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Optimistic patch target | `qk.myTeams.led` only | Spec §6.2 — no `qk.team(uuid)` subscriber in Phase 3/4 routes; patching it is invisible to the user |
| Optimistic settle invalidation | Both `qk.myTeams` AND `qk.team(uuid)` (defensive) | Spec §6.1; covers a future team-detail route landing on the same cache |
| Success overlay | Fires from `onSuccess` of `useSubmitTask` (when `reward != null`) and `useApproveJoinRequest` (when `Team.members.length + 1 >= cap`) | Spec §6.4 |
| 401 navigation | `router.navigate({ to: '/sign-in', search: { returnTo } })`, awaited; cache cleared after | §4.4 |
| `signOut` access to router | Module-level `setRouterRef` registrar (same pattern as `setSessionExpiredHandler` / `setToastSink`) — `main.tsx` registers the singleton router; tests don't need to register | Cleanest decoupling; avoids a "current-router" context |
| Demo approve button | The existing `simulateJoinApproved` button is removed entirely; the real "Approve" buttons next to each pending request (already in `MyScreen`) carry the demo flow | Spec §3.3 / §7.1 |
| `AppStateContext.tsx` removal | Single commit at the end of the plan, after every `useAppState()` callsite is gone | Catches missed callsites — typecheck fails the moment the file is deleted |
| Phase 3 lint debt | Resolve by deleting state-module entries; for surviving route files, add `// eslint-disable react-refresh/only-export-components` at the top of each `routes/*.tsx` (or the per-file comment that ESLint accepts) | Spec §10 lists this Phase-3 debt as out-of-scope, but the file-list shrink mostly resolves it; remaining warnings get a one-line suppression rather than an architecture change |

---

## File plan

Files modified (M), created (C), or deleted (D).

### Mutation upgrades — optimistic patches

| Path | Action | Contents |
|---|---|---|
| `frontend/src/mutations/teams.ts` | M | Add optimistic `onMutate`/`onError` for `useApproveJoinRequest`, `useRejectJoinRequest`, `usePatchTeam`; wire `onSuccess` overlay for approve when team hits cap |
| `frontend/src/mutations/tasks.ts` | M | Add `onSuccess` overlay trigger for `useSubmitTask` |
| `frontend/src/mutations/__tests__/teams.test.ts` | C | Optimistic patch + rollback tests (3 mutations) |
| `frontend/src/mutations/__tests__/tasks.test.ts` | C | `useSubmitTask` invalidation + overlay-trigger test |

### Form/button wire-ins

| Path | Action | Contents |
|---|---|---|
| `frontend/src/screens/ProfileSetupForm.tsx` | M | `useCompleteProfile().mutateAsync(...)`; on success, navigate from `/welcome` to `/home` |
| `frontend/src/screens/ProfileScreen.tsx` | M | Edit handler uses `usePatchMe()` |
| `frontend/src/screens/InterestForm.tsx` | M | Submit calls `useSubmitTask({ id, body: {form_type:'interest', ...} })` (the parent route component owns the mutation — see Task B3) |
| `frontend/src/screens/TicketForm.tsx` | M | Same shape with `form_type: 'ticket'` |
| `frontend/src/routes/_authed.tasks.$taskId.start.tsx` | M | Owns `useSubmitTask`; passes `onSubmit` (form data → mutate) to the form component |
| `frontend/src/screens/TeamForm.tsx` | M | Submit calls `useCreateJoinRequest().mutate(team.id)` (or whichever flow it represents); on success navigate back |
| `frontend/src/screens/TeamCard.tsx` | M | Join button → `useCreateJoinRequest`; leave button → `useLeaveTeam`; approve / reject → `useApproveJoinRequest` / `useRejectJoinRequest` |
| `frontend/src/screens/MyScreen.tsx` | M | Replace approve / reject button stubs with mutations; remove the `simulateJoinApproved` button entirely; replace remaining `useAppState()` reads |
| `frontend/src/screens/RenameTeamSheet.tsx` | M | Save → `usePatchTeam` (optimistic) |

### Auth + router 401 wiring

| Path | Action | Contents |
|---|---|---|
| `frontend/src/auth/session.ts` | M | `signOut` calls `router.navigate({...})` with `returnTo` (via `getRouterRef()`); `setSessionExpiredHandler` writes through `signOut({ reason: 'expired', returnTo })`; `_setActiveQueryClient` registrar from plan 4a stays (provider mount + signOut both reach the active QC through it) |
| `frontend/src/router.ts` | M | Export `setRouterRef`, `getRouterRef` for `signOut` to reach the router |
| `frontend/src/main.tsx` | M | Wire `setRouterRef(router)` after construction; remove `<AppStateProvider>` |
| `frontend/src/screens/__tests__/session-expiry.test.tsx` | C | End-to-end: render `/me` with valid token → MSW returns 401 → expect navigate to `/sign-in?returnTo=/me` and toast visible |

### Final cleanup

| Path | Action | Contents |
|---|---|---|
| `frontend/src/state/AppStateContext.tsx` | D | Delete |
| `frontend/src/state/__tests__/` | D | Delete if empty |
| `frontend/src/state/` | D | Delete if empty |
| `frontend/eslint.config.js` (or wherever lint config lives) | M | Remove warning suppressions for `state/*` if present; per-file disable for surviving route modules emitting `react-refresh/only-export-components` |
| `docs/production-launch-plan.md` | M | Phase 4 checkbox → checked; Phase 3 debt items resolved-by-Phase-4 crossed out |

---

## Section A — Optimistic mutation upgrades

**Exit criteria:** all three mutations from spec §6.2 patch the `qk.myTeams.led` cache before the network round-trip; on error they roll back; on settle they invalidate per §6.1. Behavior tests pass.

### Task A1: `useApproveJoinRequest` — optimistic patch + rollback

**Files:**
- Modify: `frontend/src/mutations/teams.ts`
- Create: `frontend/src/mutations/__tests__/teams.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// frontend/src/mutations/__tests__/teams.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import {
  useApproveJoinRequest,
  useRejectJoinRequest,
  usePatchTeam,
} from "../teams";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";
import type { components } from "../../api/schema";

type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type Team = components["schemas"]["Team"];
type JoinRequest = components["schemas"]["JoinRequest"];

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function teamWithRequest(): Team {
  const req: JoinRequest = {
    id: "00000000-0000-0000-0000-000000000900",
    team_id: f.teamJetLed.id,
    user: {
      id: "00000000-0000-0000-0000-000000000801",
      display_id: "UALEX",
      name: "陳志豪",
      avatar_url: null,
    },
    status: "pending",
    requested_at: "2026-04-20T00:00:00Z",
  };
  return { ...f.teamJetLed, requests: [req], members: [] };
}

afterEach(() => {
  // server.resetHandlers() runs in setup.ts afterEach
});

describe("useApproveJoinRequest (optimistic)", () => {
  it("patches qk.myTeams.led before the network responds", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    let release: () => void = () => {};
    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/approve`,
        () =>
          new Promise((res) => {
            release = () =>
              res(HttpResponse.json({ ...team, requests: [], members: [team.requests![0].user] }));
          }),
      ),
    );

    const { result } = renderHook(() => useApproveJoinRequest(), {
      wrapper: wrap(qc),
    });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => {
      const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      expect(after?.led?.members).toHaveLength(1);
      expect(after?.led?.requests).toHaveLength(0);
    });

    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back on error", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    const before = { led: team, joined: null };
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, before);

    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/approve`,
        () => HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useApproveJoinRequest(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<MeTeamsResponse>(qk.myTeams)).toEqual(before);
  });
});

describe("useRejectJoinRequest (optimistic)", () => {
  it("removes the request from led without adding a member", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/reject`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => useRejectJoinRequest(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
    expect(after?.led?.requests).toHaveLength(0);
    expect(after?.led?.members).toHaveLength(0);
  });
});

describe("usePatchTeam (optimistic alias/topic swap)", () => {
  it("patches alias on led immediately", async () => {
    const qc = makeClient();
    const team: Team = { ...f.teamJetLed, alias: null };
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    server.use(
      http.patch(`/api/v1/teams/${team.id}`, () =>
        HttpResponse.json({ ...team, alias: "夢想隊" }),
      ),
    );

    const { result } = renderHook(() => usePatchTeam(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, body: { alias: "夢想隊" } });

    await waitFor(() => {
      const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      expect(after?.led?.alias).toBe("夢想隊");
    });
  });
});
```

- [ ] **Step 2: Run; expect 3 fails (current default-invalidate has no optimistic patch)**

```
pnpm -C frontend test src/mutations/__tests__/teams.test.ts
```

- [ ] **Step 3: Define `pushSuccess` in `useUIState.ts` first**

`pushSuccess` is a module-level overlay pusher (mirrors `pushToast`) that the optimistic mutation onSuccess can call from outside the React tree. Add it before wiring the mutation so the import resolves.

Edit `frontend/src/ui/useUIState.ts`:

```ts
import { useContext } from "react";
import { UIStateCtx } from "./UIStateProvider";

export function useUIState() {
  const ctx = useContext(UIStateCtx);
  if (!ctx) throw new Error("useUIState must be used inside <UIStateProvider>");
  return ctx;
}

// Module-level pushers, mirror the toast pattern so callers outside
// the React tree (mutation onSuccess, signOut) can fire overlays.
export type SuccessPayload = {
  color: string;
  points: number;
  bonus?: string | null;
  title?: string;
};
let successSink: ((p: SuccessPayload) => void) | null = null;
export function setSuccessSink(fn: typeof successSink): void {
  successSink = fn;
}
export function pushSuccess(p: SuccessPayload): void {
  successSink?.(p);
}
export { pushToast } from "./toasts";
```

Wire the sink in `UIStateProvider`:

```tsx
// frontend/src/ui/UIStateProvider.tsx — inside provider component
import { setSuccessSink } from "./useUIState";
// ...
useEffect(() => {
  setSuccessSink((p) => setSuccessData(p));
  return () => setSuccessSink(null);
}, []);
```

- [ ] **Step 4: Upgrade `useApproveJoinRequest` to optimistic**

In `frontend/src/mutations/teams.ts`, add the imports needed by the optimistic body and replace `useApproveJoinRequest`:

```ts
// Top of file — additions to existing imports
import { pushToast } from "../ui/toasts";
import { pushSuccess } from "../ui/useUIState";

// existing TeamUpdate alias stays; add MeTeamsResponse:
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
```

Replace the existing `useApproveJoinRequest`:

```ts
export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.approveJoinRequest(teamId, reqId),
    onMutate: async ({ teamId, reqId }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId && team.requests) {
        const req = team.requests.find((r) => r.id === reqId);
        if (req) {
          qc.setQueryData<MeTeamsResponse>(qk.myTeams, {
            ...prev,
            led: {
              ...team,
              members: [...team.members, req.user],
              requests: team.requests.filter((r) => r.id !== reqId),
            },
          });
        }
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "審核失敗，請再試一次" });
    },
    onSuccess: (team) => {
      // §6.4: success overlay if approval pushed the team to cap.
      if (team.members.length >= team.cap) {
        pushSuccess({
          color: "#ff5c8a",
          points: 120,
          bonus: null,
          title: "組隊完成！",
        });
      }
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}
```

- [ ] **Step 5: Run the approve tests**

```
pnpm -C frontend test src/mutations/__tests__/teams.test.ts -t "useApproveJoinRequest"
```

Expected: 2 PASS.

- [ ] **Step 6: Upgrade `useRejectJoinRequest` to optimistic**

```ts
export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.rejectJoinRequest(teamId, reqId),
    onMutate: async ({ teamId, reqId }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<components["schemas"]["MeTeamsResponse"]>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId && team.requests) {
        qc.setQueryData<components["schemas"]["MeTeamsResponse"]>(qk.myTeams, {
          ...prev,
          led: { ...team, requests: team.requests.filter((r) => r.id !== reqId) },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "操作失敗" });
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
    },
  });
}
```

- [ ] **Step 7: Upgrade `usePatchTeam` to optimistic**

```ts
export function usePatchTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: TeamUpdate }) =>
      api.patchTeam(teamId, body),
    onMutate: async ({ teamId, body }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<components["schemas"]["MeTeamsResponse"]>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId) {
        qc.setQueryData<components["schemas"]["MeTeamsResponse"]>(qk.myTeams, {
          ...prev,
          led: {
            ...team,
            name: body.name ?? team.name,
            alias: body.alias ?? team.alias,
            topic: body.topic ?? team.topic,
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "儲存失敗" });
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
```

- [ ] **Step 8: Run all team-mutation tests**

```
pnpm -C frontend test src/mutations/__tests__/teams.test.ts
```

Expected: 4 PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/mutations/teams.ts frontend/src/mutations/__tests__/teams.test.ts frontend/src/ui/useUIState.ts frontend/src/ui/UIStateProvider.tsx
git commit -m "feat(frontend): optimistic approve/reject/patch team mutations"
```

### Task A2: `useSubmitTask` — success overlay trigger

**Files:**
- Modify: `frontend/src/mutations/tasks.ts`
- Create: `frontend/src/mutations/__tests__/tasks.test.ts`

- [ ] **Step 1: Write tests**

```ts
// frontend/src/mutations/__tests__/tasks.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { useSubmitTask } from "../tasks";
import * as ui from "../../ui/useUIState";
import * as f from "../../test/msw/fixtures";

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("useSubmitTask", () => {
  it("fires pushSuccess when response includes a reward", async () => {
    const qc = client();
    const spy = vi.spyOn(ui, "pushSuccess");
    const task = f.tasksList[0]; // T1 from fixtures
    const reward = {
      id: "00000000-0000-0000-0000-000000000700",
      task_id: task.id,
      title: task.title,
      points: task.points,
      bonus: "limited badge",
      status: "earned" as const,
      granted_at: "2026-04-20T00:00:00Z",
    };
    server.use(
      http.post(`/api/v1/tasks/${task.id}/submit`, () =>
        HttpResponse.json({ task: { ...task, status: "completed" }, reward }),
      ),
    );

    const { result } = renderHook(() => useSubmitTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    result.current.mutate({
      id: task.id,
      body: {
        form_type: "interest",
        name: "Jet",
        phone: "0912",
        interests: ["nature"],
        availability: ["weekend"],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ color: task.color, points: task.points, bonus: "limited badge" }),
    );
  });

  it("does not fire pushSuccess when reward is null", async () => {
    const qc = client();
    const spy = vi.spyOn(ui, "pushSuccess");
    const task = f.tasksList[0];
    server.use(
      http.post(`/api/v1/tasks/${task.id}/submit`, () =>
        HttpResponse.json({ task: { ...task, status: "completed" }, reward: null }),
      ),
    );
    const { result } = renderHook(() => useSubmitTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({
      id: task.id,
      body: {
        form_type: "interest",
        name: "Jet",
        phone: "0912",
        interests: ["x"],
        availability: ["y"],
      },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add `onSuccess` to `useSubmitTask`**

In `frontend/src/mutations/tasks.ts`:

```ts
import { pushSuccess } from "../ui/useUIState";
// ...
onSuccess: (data, { id }) => {
  if (data.reward) {
    pushSuccess({
      color: data.task.color,
      points: data.task.points,
      bonus: data.reward.bonus,
    });
  }
  qc.invalidateQueries({ queryKey: qk.task(id) });
  qc.invalidateQueries({ queryKey: qk.myTasks });
  qc.invalidateQueries({ queryKey: qk.myRewards });
  qc.invalidateQueries({ queryKey: qk.me });
  qc.invalidateQueries({ queryKey: ["rank"] });
},
```

- [ ] **Step 3: Run, commit**

```
pnpm -C frontend test src/mutations/__tests__/tasks.test.ts
```

```bash
git add frontend/src/mutations/tasks.ts frontend/src/mutations/__tests__/tasks.test.ts
git commit -m "feat(frontend): useSubmitTask fires success overlay on reward"
```

---

## Section B — Form & button wire-ins

**Exit criteria:** every form submit and action button calls a mutation hook (no `useAppState()` stub references remain).

### Task B1: `ProfileSetupForm` → `useCompleteProfile`

**Files:**
- Modify: `frontend/src/screens/ProfileSetupForm.tsx`
- Modify: `frontend/src/routes/welcome.tsx` (if it owns the redirect-after-success)

- [ ] **Step 1: Find current call**

```
grep -n 'handleProfileComplete\|useAppState' frontend/src/screens/ProfileSetupForm.tsx
```

- [ ] **Step 2: Replace**

Inside the form's submit handler:

```tsx
import { useCompleteProfile } from "../mutations/me";
import { useNavigate } from "@tanstack/react-router";
import type { components } from "../api/schema";

type ProfileCreate = components["schemas"]["ProfileCreate"];

const { mutateAsync: completeProfile, isPending } = useCompleteProfile();
const navigate = useNavigate();

const handleSubmit = async (form: ProfileCreate) => {
  await completeProfile(form);
  navigate({ to: "/home" });
};
```

The form's existing per-field state stays — only the submit handler changes.

- [ ] **Step 3: Disable submit button while `isPending` and surface error**

```tsx
{error && <p style={{ color: "#c00" }}>{error.message}</p>}
<button type="submit" disabled={isPending}>{isPending ? "建立中..." : "完成"}</button>
```

The hook's `error` field is what to render. Wire up:

```tsx
const m = useCompleteProfile();
// ... m.mutate / m.mutateAsync / m.isPending / m.error
```

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test
```

```bash
git add frontend/src/screens/ProfileSetupForm.tsx
git commit -m "feat(frontend): ProfileSetupForm uses useCompleteProfile"
```

### Task B2: `ProfileScreen` edit → `usePatchMe`

**Files:**
- Modify: `frontend/src/screens/ProfileScreen.tsx` (or whichever file owns the edit form)

- [ ] **Step 1: Replace handler**

```tsx
import { usePatchMe } from "../mutations/me";

const { mutateAsync: patchMe, isPending } = usePatchMe();

const handleSave = async (changes: Partial<ProfileUpdate>) => {
  await patchMe(changes);
  // navigation back is unchanged from the current edit flow
};
```

- [ ] **Step 2: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/ProfileScreen.tsx
git commit -m "feat(frontend): ProfileScreen edit uses usePatchMe"
```

### Task B3: Task submit forms → `useSubmitTask`

**Files:**
- Modify: `frontend/src/screens/InterestForm.tsx`
- Modify: `frontend/src/screens/TicketForm.tsx`
- Modify: `frontend/src/routes/_authed.tasks.$taskId.start.tsx`

The route component owns the mutation; the form component receives `onSubmit(body)` and calls it.

- [ ] **Step 1: Update route component**

```tsx
// frontend/src/routes/_authed.tasks.$taskId.start.tsx (additions)
import { useSubmitTask } from "../mutations/tasks";
import type { components } from "../api/schema";

function StartRoute() {
  const navigate = useNavigate();
  const { taskId } = taskStartRoute.useParams();
  const { data: tasks } = useSuspenseQuery(myTasksQueryOptions());
  const task = tasks.find((t) => t.display_id === taskId);
  if (!task) throw notFound();
  const goDetail = () =>
    navigate({ to: "/tasks/$taskId", params: { taskId: task.display_id } });
  const submit = useSubmitTask();

  if (task.form_type === "interest") {
    return (
      <InterestForm
        onCancel={goDetail}
        isSubmitting={submit.isPending}
        onSubmit={async (body) => {
          await submit.mutateAsync({ id: task.id, body: { form_type: "interest", ...body } });
          goDetail();
        }}
      />
    );
  }
  if (task.form_type === "ticket") {
    return (
      <TicketForm
        onCancel={goDetail}
        isSubmitting={submit.isPending}
        onSubmit={async (body) => {
          await submit.mutateAsync({ id: task.id, body: { form_type: "ticket", ...body } });
          goDetail();
        }}
      />
    );
  }
  if (task.is_challenge) {
    return <TeamForm onCancel={goDetail} onSubmit={goDetail} />; // covered by Task B4
  }
  throw notFound();
}
```

- [ ] **Step 2: Update `InterestForm` props**

```tsx
// frontend/src/screens/InterestForm.tsx (signature)
export interface InterestFormProps {
  onCancel: () => void;
  onSubmit: (body: {
    name: string;
    phone: string;
    interests: string[];
    skills?: string[];
    availability: string[];
  }) => void | Promise<void>;
  isSubmitting?: boolean;
}
```

The form's existing field state collects values and passes them to `onSubmit` as the body shape (without the `form_type` discriminator — the route adds it).

- [ ] **Step 3: Same for `TicketForm`**

```tsx
export interface TicketFormProps {
  onCancel: () => void;
  onSubmit: (body: {
    name: string;
    ticket_725: string;
    ticket_726: string;
    note?: string | null;
  }) => void | Promise<void>;
  isSubmitting?: boolean;
}
```

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
```

```bash
git add frontend/src/screens/InterestForm.tsx frontend/src/screens/TicketForm.tsx frontend/src/routes/_authed.tasks.$taskId.start.tsx
git commit -m "feat(frontend): task submit forms call useSubmitTask"
```

### Task B4: `TeamForm` / `TeamCard` join + leave

**Files:**
- Modify: `frontend/src/screens/TeamForm.tsx`
- Modify: `frontend/src/screens/TeamCard.tsx`

- [ ] **Step 1: `TeamCard` join button**

Find the existing join button (it currently calls `useAppState().joinTeam(team)`). Replace with:

```tsx
import { useCreateJoinRequest } from "../mutations/teams";
const join = useCreateJoinRequest();

<button
  type="button"
  disabled={join.isPending}
  onClick={() => join.mutate(team.id)}
>
  申請加入
</button>
```

- [ ] **Step 2: Leave button (member side)**

```tsx
import { useLeaveTeam } from "../mutations/teams";
const leave = useLeaveTeam();
<button onClick={() => leave.mutate(team.id)}>離開團隊</button>
```

- [ ] **Step 3: `TeamForm` create / cancel**

If `TeamForm` represents the "submit a join request via search" flow, it likely takes a `team` prop; on submit, call `useCreateJoinRequest().mutate(team.id)` then navigate back.

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
```

```bash
git add frontend/src/screens/TeamForm.tsx frontend/src/screens/TeamCard.tsx
git commit -m "feat(frontend): team join/leave use real mutations"
```

### Task B5: `MyScreen` approve/reject + remove `simulateJoinApproved`

**Files:**
- Modify: `frontend/src/screens/MyScreen.tsx`

- [ ] **Step 1: Replace approve button**

```tsx
import { useApproveJoinRequest, useRejectJoinRequest } from "../mutations/teams";

const approve = useApproveJoinRequest();
const reject = useRejectJoinRequest();

// Inside the per-request rendering:
<button
  type="button"
  disabled={approve.isPending}
  onClick={() => approve.mutate({ teamId: ledTeam.id, reqId: req.id })}
>
  ✓ 通過
</button>
<button
  type="button"
  disabled={reject.isPending}
  onClick={() => reject.mutate({ teamId: ledTeam.id, reqId: req.id })}
>
  × 拒絕
</button>
```

- [ ] **Step 2: Remove the `simulateJoinApproved` button entirely**

Find it:

```
grep -n 'simulateJoinApproved' frontend/src/screens/MyScreen.tsx
```

Delete the button + associated handler. The seed now provides real pending requests for the demo flow; the simulation button was a substitute and is no longer needed.

- [ ] **Step 3: Wire any remaining `useAppState()` reads through proper hooks**

```
grep -n 'useAppState' frontend/src/screens/MyScreen.tsx
```

Expected: zero matches after this task. Any reference to `joinTeam` etc. comes from sub-button handlers — wire each to its mutation.

- [ ] **Step 4: Run, commit**

```
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
```

```bash
git add frontend/src/screens/MyScreen.tsx
git commit -m "feat(frontend): MyScreen approve/reject mutations + drop simulate"
```

### Task B6: `RenameTeamSheet` → `usePatchTeam`

**Files:**
- Modify: `frontend/src/screens/RenameTeamSheet.tsx`

- [ ] **Step 1: Replace handler**

```tsx
import { usePatchTeam } from "../mutations/teams";
const patch = usePatchTeam();

const handleSave = async () => {
  await patch.mutateAsync({ teamId: team.id, body: { alias: input } });
  onClose();
};
```

The optimistic patch (Task A1) handles the snappy update; on error, `pushToast` already fires.

- [ ] **Step 2: Run, commit**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git add frontend/src/screens/RenameTeamSheet.tsx
git commit -m "feat(frontend): RenameTeamSheet uses usePatchTeam (optimistic)"
```

### Task B7: Sign-out callsites

**Files:**
- Modify: any screen / nav button still calling `useAppState().handleSignOut()`

- [ ] **Step 1: Find them**

```
grep -rn 'handleSignOut' frontend/src/
```

Expected: a couple of remaining call sites (HomeScreen was migrated in 4b; others may not have been). Replace each with:

```tsx
import { useAuth } from "../auth/session";
const { signOut } = useAuth();
// ...
<button onClick={() => signOut({ reason: "user" })}>登出</button>
```

- [ ] **Step 2: Run, commit per file**

```bash
pnpm -C frontend test && pnpm -C frontend exec tsc --noEmit
git commit -am "feat(frontend): remaining sign-out callsites use useAuth"
```

---

## Section C — Router-aware 401 + session-expired flow

**Exit criteria:** when an authed query returns 401, the user lands on `/sign-in?returnTo=<previous-path>` with a toast visible. End-to-end test in MSW passes.

### Task C1: `setRouterRef` in `router.ts`

**Files:**
- Modify: `frontend/src/router.ts`

- [ ] **Step 1: Add the ref + setter**

Append to `frontend/src/router.ts`:

```ts
let routerRef: ReturnType<typeof createAppRouter> | null = null;
export function setRouterRef(r: ReturnType<typeof createAppRouter> | null): void {
  routerRef = r;
}
export function getRouterRef(): ReturnType<typeof createAppRouter> | null {
  return routerRef;
}
```

- [ ] **Step 2: Wire from `main.tsx`**

```tsx
// frontend/src/main.tsx
import { createAppRouter, setRouterRef } from "./router";
const router = createAppRouter({ queryClient });
setRouterRef(router);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/router.ts frontend/src/main.tsx
git commit -m "refactor(frontend): module-level router ref for signOut navigation"
```

### Task C2: `signOut` navigates via router

**Files:**
- Modify: `frontend/src/auth/session.ts`

- [ ] **Step 1: Update `signOut`**

```tsx
import { getRouterRef } from "../router";
// ...

export const signOut = async (opts: SignOutOpts = {}): Promise<void> => {
  if (inFlightSignOut) return;
  inFlightSignOut = true;
  try {
    const token = tokenStore.get();
    if (token) void performLogoutBestEffort(token);
    if (opts.reason === "expired") {
      pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
    }
    const router = getRouterRef();
    tokenStore.clear();
    if (router) {
      await router.navigate({
        to: "/sign-in",
        search: opts.returnTo ? { returnTo: opts.returnTo } : {},
      });
    }
    activeQueryClient?.clear();
  } finally {
    inFlightSignOut = false;
  }
};
```

The `signOut` callback inside `AuthProvider` becomes a thin wrapper that calls this module-level function (so existing `useAuth().signOut()` callers still work):

```tsx
const signOutFromCtx = useCallback(async (opts: SignOutOpts = {}) => {
  await signOut(opts);
  setSignedIn(false);
}, []);
```

- [ ] **Step 2: Update `setSessionExpiredHandler` registration**

The 4a stub did the bare-minimum on 401 (`tokenStore.clear()` + toast). Replace with the full flow:

```ts
setSessionExpiredHandler(({ returnTo }) => {
  void signOut({ reason: "expired", returnTo });
});
```

- [ ] **Step 3: Run all auth tests**

```
pnpm -C frontend test src/auth
```

Expected: still green. The `signOut` test from plan 4a will land on `/sign-in` now (no router in the test → no-op navigate, but the `signedIn` flag still flips).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/auth/session.ts
git commit -m "feat(frontend): signOut navigates via router with returnTo"
```

### Task C3: End-to-end 401 interceptor test

**Files:**
- Create: `frontend/src/screens/__tests__/session-expiry.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
// frontend/src/screens/__tests__/session-expiry.test.tsx
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { renderRoute } from "../../test/renderRoute";
import { tokenStore } from "../../auth/token";

describe("401 interceptor — session expiry", () => {
  it("redirects to /sign-in?returnTo=<prev> and shows toast on 401", async () => {
    // Override default success: every query returns 401
    server.use(
      http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })),
      http.get("/api/v1/me/tasks", () => new HttpResponse(null, { status: 401 })),
      http.get("/api/v1/me/teams", () => new HttpResponse(null, { status: 401 })),
    );

    const { router } = renderRoute("/me", { token: "expired-token" });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/sign-in"),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ returnTo: expect.stringContaining("/me") }),
    );
    expect(tokenStore.get()).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/工作階段已過期/)).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run**

```
pnpm -C frontend test src/screens/__tests__/session-expiry.test.tsx
```

Expected: PASS. If the test fails because the toast never renders, check that `<UIStateProvider>` is wrapping the `<RouterProvider>` in `renderRoute` (it should be, per plan 4b's helper update) and that there's a Toast container that visually renders queued toasts. If no Toast container exists, add a tiny one inside `__root.tsx`:

```tsx
// in RootLayout
{toasts.map((t) => (
  <div key={t.id} role="status">{t.message}</div>
))}
```

(Read `useUIState()` for `toasts` and `dismissToast` in `__root.tsx`. The visual styling can be plain — Phase 4 ships behavior, not toast aesthetics.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/__tests__/session-expiry.test.tsx frontend/src/routes/__root.tsx
git commit -m "test(frontend): 401 interceptor end-to-end (redirect + toast)"
```

### Task C4: Sign-in screen shows session-expired toast on visit-from-redirect

**Files:**
- Verify: `frontend/src/routes/sign-in.tsx`

The toast already fires from `signOut({reason:'expired', returnTo})` (Task C2), so `/sign-in?returnTo=...` already shows it via the toast container in `__root.tsx`. No additional code needed unless we want the toast to *persist* when the user lands on `/sign-in` via a direct URL (not via the redirect path). For Phase 4, the redirect path is the only producer — skip.

- [ ] **Step 1: Manual smoke** — open the app, sign in, manually `localStorage.removeItem('gal.token')`, navigate to `/me`, confirm the toast appears on `/sign-in`.

- [ ] **Step 2: No commit** if no code change.

---

## Section D — Final cleanup

**Exit criteria:** `AppStateContext.tsx` deleted; provider removed from `main.tsx`; lint debt resolved; production launch plan updated.

### Task D1: Delete `AppStateContext.tsx`

**Files:**
- Delete: `frontend/src/state/AppStateContext.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Verify no `useAppState` or `AppStateProvider` callsites**

```
grep -rn 'useAppState\|AppStateProvider\|AppStateContext' frontend/src/
```

Expected: zero matches outside the file itself. If matches remain, identify the screen and migrate it to a mutation/hook before deleting.

- [ ] **Step 2: Remove `<AppStateProvider>` from `main.tsx`**

```tsx
// before:
<AuthProvider>
  <AppStateProvider>
    <UIStateProvider>
// after:
<AuthProvider>
  <UIStateProvider>
```

Also drop the `import { AppStateProvider } from "./state/AppStateContext";` line.

- [ ] **Step 3: Delete the file**

```bash
git rm frontend/src/state/AppStateContext.tsx
```

If `frontend/src/state/__tests__/` is empty, remove the directory:

```bash
rmdir frontend/src/state/__tests__ 2>/dev/null
rmdir frontend/src/state 2>/dev/null
```

- [ ] **Step 4: Typecheck + tests**

```
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend test
```

Expected: green. If `tsc` errors with "Cannot find module '../state/AppStateContext'" — a missed callsite. Migrate before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(frontend): delete AppStateContext (replaced by Query + Auth + UI)"
```

### Task D2: Lint debt — `react-refresh/only-export-components`

**Files:**
- Modify: `frontend/eslint.config.js` (or whichever file holds the lint config)

- [ ] **Step 1: Run lint**

```
pnpm -C frontend lint
```

Note any remaining `react-refresh/only-export-components` warnings — should be fewer than the 11 the Phase-3 debt list flagged (state modules and `renderRoute` are deleted/refactored).

- [ ] **Step 2: For surviving warnings on `routes/*.tsx`**

The TanStack Router pattern makes route files unavoidably co-export a component AND a route object, which violates the rule. Two options:

a. Per-file disable at the top:

```tsx
/* eslint-disable react-refresh/only-export-components */
```

b. Glob-disable the rule in `eslint.config.js` for `routes/**/*.tsx`:

```js
{
  files: ["src/routes/**/*.tsx"],
  rules: { "react-refresh/only-export-components": "off" },
},
```

Pick (b) — fewer per-file noise comments. Add to the project's eslint config.

- [ ] **Step 3: Run lint until clean**

```
pnpm -C frontend lint
```

Expected: no warnings.

- [ ] **Step 4: Commit**

```bash
git add frontend/eslint.config.js
git commit -m "chore(frontend): silence react-refresh rule on route co-exports"
```

### Task D3: Update `docs/production-launch-plan.md`

**Files:**
- Modify: `docs/production-launch-plan.md`

- [ ] **Step 1: Open the file and find Phase 4**

Mark the two items checked:

```
- [x] Add TanStack Query for data fetching, cache, loading/error states
- [x] Replace in-file mock arrays with real fetches
```

- [ ] **Step 2: Cross out Phase 3 debt items resolved by Phase 4**

In the "Tech debt / review findings (Phase 3)" section, strike through (or move to a "resolved by Phase 4" sub-section):

- `react-refresh/only-export-components` warnings (resolved by Task D2 + state-module deletion)

The other Phase 3 items (flat route tree, `_authed` guard, `router.invalidate()`) are deliberately untouched; leave them as-is.

- [ ] **Step 3: Add a "Phase 4 closeout" debt section** for items the plan deferred

Append after Phase 5 sections:

```markdown
## Tech debt / review findings (Phase 4)

Surfaced during Phase 4 (frontend wired to backend). Address as each becomes actionable.

### Auth / session
- **Token storage in `localStorage`** — vulnerable to XSS; deliberate choice for Phase 4 (spec §4.2). Phase 6 should revisit when real Google OAuth lands.
- **No refresh-token rotation** — access token TTL is the entire session. Spec §10 + Phase 5b debt.

### Optimistic-mutation gaps
- `qk.team(uuid)` is invalidated defensively but never patched optimistically — Phase 3/4 has no team-detail route subscriber. When a team-detail deep link ships, extend the three optimistic mutations in `mutations/teams.ts` to also patch `qk.team(uuid)` when present.

### Demo flow ergonomics
- Seed reaches at most 3/6 on T3 — completing T3 requires extra manual approvals (spec §7.1). Add `just seed-extra-team-members` if this becomes a bottleneck for product demos.

### Toast UX
- Inline toast container in `__root.tsx` is text-only. Replace with a real toast component (positioning, fade, dismiss) when frontend polish lands.
```

- [ ] **Step 4: Commit**

```bash
git add docs/production-launch-plan.md
git commit -m "docs: mark Phase 4 complete + log Phase 4 closeout debt"
```

---

## Section E — Final verification

### Task E1: Automated guards

- [ ] **Step 1: All `useAppState`-related identifiers gone**

```
grep -rn 'useAppState\|AppStateProvider\|AppStateContext\|simulateJoinApproved\|userIdFromEmail\|syncTeamTask' frontend/src/
```

Expected: zero matches.

- [ ] **Step 2: state directory gone**

```
test ! -d frontend/src/state && echo OK
```

- [ ] **Step 3: Test, typecheck, build, lint, backend CI**

```
pnpm -C frontend test
pnpm -C frontend exec tsc --noEmit
pnpm -C frontend build
pnpm -C frontend lint
just -f backend/justfile ci
```

Expected: all green.

### Task E2: Manual smoke walkthrough

- [ ] **Step 1: Boot stack**

```
just -f backend/justfile db-up
just -f backend/justfile migrate
just -f backend/justfile seed-reset
just dev
```

- [ ] **Step 2: Sign in as Jet, approve a request, verify task-3 progress**

- Open `http://localhost:5173/sign-in` → click `金杰 (Jet Kan)`
- Land on `/home`; navigate to `/me`
- See 2 pending requests (alex, mei)
- Click `✓ 通過` next to alex → row instantly disappears (optimistic) → 1 pending remains, 1 member added
- Click `✓ 通過` next to mei → row disappears → 0 pending, 2 members
- Navigate to `/tasks/T3` → team_progress total=3 (jet+alex+mei), cap=6, status=in_progress

- [ ] **Step 3: Rename team optimistically**

- On `/me`, open the rename sheet → enter alias `夢想隊` → save
- Sheet closes; team alias updates instantly (optimistic)
- Refresh the browser → alias persists from server

- [ ] **Step 4: Submit T1 (interest form)**

- `/tasks/T1` → click 開始 → fill form → submit
- Success overlay fires (`50` points + bonus from server's `Reward.bonus`)
- Back on `/tasks` → T1 status flips to `completed` → T2 unlocks (`requires` includes T1's uuid; server-computed status)

- [ ] **Step 5: Sign out + 401 path**

- Click 登出 → land on `/sign-in`; toast does NOT appear (no expiry, just user-initiated)
- Sign in again as jet
- Open devtools → `localStorage.removeItem('gal.token')`
- Navigate to `/me` → 401 fires → land on `/sign-in?returnTo=/me`, toast shows "您的工作階段已過期，請重新登入"
- Sign in again → land on `/me` (returnTo honored)

- [ ] **Step 6: Sign in as alex → outgoing request visible**

- Sign out, sign in as `陳志豪 (Alex Chen)` → land on `/home`
- Navigate to `/me` → empty led team + outgoing pending request against jet visible

- [ ] **Step 7: Done**

Phase 4 is shipped end-to-end. Open the PR.

```bash
git push -u origin phase-4
```

---

## Out of scope for plan 4c (Phase 6+)

Per spec §10:
- Real Google OAuth (still using stub)
- Refresh-token rotation
- httpOnly cookie storage
- Rank N+1 backend rewrite (Phase 5d debt)
- Reward `claim` transition (Phase 5d debt)
- News admin endpoints (Phase 5d debt)
- Per-route invalidation tightening for `router.invalidate()` (Phase 3 debt)
- Splitting nested layouts back together (Phase 3 debt)

New Phase 4 closeout debt logged in `docs/production-launch-plan.md` (Task D3).
