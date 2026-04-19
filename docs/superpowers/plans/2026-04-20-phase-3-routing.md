# Phase 3 — Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `useState<ScreenId>` screen switching in `App.tsx` with TanStack Router, giving every screen a bookmarkable URL, working browser back/forward, and a declarative auth guard.

**Architecture:** Code-based TanStack Router with a `__root` layout (global styles + success overlay) and an `_authed` layout route holding the auth guard. All domain state that used to live in `App.tsx` moves verbatim into an `AppStateProvider` (React Context); screens read it via `useAppState()` + `useNavigate()` instead of receiving callback props. `App.tsx` is deleted.

**Tech Stack:** React 18 + TypeScript + Vite + TanStack Router; Vitest + Testing Library + jsdom for route-level tests.

**Reference spec:** `docs/superpowers/specs/2026-04-20-phase-3-routing-design.md`

**Working directory:** A worktree at `.worktrees/phase-3-routing/` (created by subagent-driven-development at session start). All paths below are relative to `frontend/` unless absolute.

**Parallelism hint:** Tasks 6, 7, and 8 are independent once Tasks 1–5 are in place (each migrates disjoint routes/screens). A dispatcher may run them concurrently if desired.

**On "...rest unchanged" instructions:** Several screen-refactor steps (e.g. 6.3, 7.3, 7.4, 8.3, 8.4) describe a partial transformation ("drop this prop type, swap this import, rest unchanged"). When you see one, **read the full file first** so you understand what "rest" means for that specific file. The diff you apply should be surgical: remove the Props type + its destructuring, add the hook calls, rewrite the callbacks, leave everything else (styling, helpers, sub-components, JSX) untouched. If you find yourself rewriting large swaths of unchanged markup, stop — you're overstepping.

---

## File Structure

**New files under `frontend/src/`:**
- `state/AppStateContext.tsx` — provider + `useAppState()`. Holds everything that used to live in `App.tsx` state.
- `router.ts` — `createRouter`, route tree assembly, typed router context type.
- `routes/__root.tsx` — global layout (GlobalStyles, success overlay, `<Outlet />`).
- `routes/index.tsx` — `/` landing.
- `routes/sign-in.tsx` — `/sign-in`.
- `routes/welcome.tsx` — `/welcome`.
- `routes/_authed.tsx` — auth-guard layout (no URL segment).
- `routes/_authed.home.tsx`, `_authed.tasks.tsx`, `_authed.tasks.$taskId.tsx`, `_authed.tasks.$taskId.start.tsx`, `_authed.leaderboard.tsx`, `_authed.me.tsx`, `_authed.me.profile.tsx`, `_authed.me.profile.edit.tsx`, `_authed.rewards.tsx` — authed routes (filenames are convention only; tree is assembled in `router.ts`).
- `routes/__tests__/routing.test.tsx` — route-level integration tests.
- `test/setup.ts` — Vitest/Testing-Library setup.
- `vitest.config.ts` — Vitest config.

**Modified:**
- `main.tsx` — mount `AppStateProvider` + `RouterProvider`, remove `<App />`.
- `types.ts` — remove `ScreenId` export.
- `package.json` — new deps + `test` script.
- Every file under `src/screens/` — drop domain prop interfaces; read from `useAppState()` + `useNavigate()`.

**Deleted:**
- `src/App.tsx`.

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`

- [ ] **Step 1.1: Install runtime + dev deps**

Run (from `frontend/`):
```bash
pnpm add @tanstack/react-router
pnpm add -D @tanstack/react-router-devtools vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected: `package.json` updated, `pnpm-lock.yaml` regenerated.

- [ ] **Step 1.2: Add `test` script to `package.json`**

Modify the `scripts` object in `frontend/package.json`:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "format": "prettier --write --ignore-unknown .",
  "format:check": "prettier --check --ignore-unknown .",
  "lint": "eslint --fix .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 1.3: Create `vitest.config.ts`**

Create `frontend/vitest.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 1.4: Create `test/setup.ts`**

Create `frontend/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 1.5: Add Vitest globals to tsconfig**

The project has no `tsconfig.app.json`; types belong in `frontend/tsconfig.json`. Add `"types": ["vitest/globals"]` to `compilerOptions` (no such key exists yet, so create it):
```json
{
  "compilerOptions": {
    // ...existing options unchanged...
    "types": ["vitest/globals"]
  }
}
```

- [ ] **Step 1.6: Smoke-check the setup with a trivial test**

Create `frontend/src/test/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: PASS, 1 test.

- [ ] **Step 1.7: Remove the smoke test and commit**

Delete `frontend/src/test/smoke.test.ts`.

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vitest.config.ts frontend/src/test/setup.ts frontend/tsconfig.json
git commit -m "build: add TanStack Router + Vitest + Testing Library"
```

---

## Task 2: Create `AppStateContext`

Move all the state and handlers currently in `App.tsx` into a provider. This task does not remove `App.tsx` yet — the provider replaces its internals in a later task. Writing this in isolation lets the rest of the migration consume a stable API.

**Files:**
- Create: `frontend/src/state/AppStateContext.tsx`
- Create: `frontend/src/state/__tests__/AppStateContext.test.tsx`

- [ ] **Step 2.1: Write the failing test**

Create `frontend/src/state/__tests__/AppStateContext.test.tsx`:
```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppStateProvider, useAppState } from "../AppStateContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

describe("AppStateContext", () => {
  it("starts with a null user and the TASKS fixture", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.tasks.length).toBeGreaterThan(0);
  });

  it("handleSignIn sets the user with a derived id", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => {
      result.current.handleSignIn({
        email: "jet@example.com",
        name: "Jet",
        avatar: "linear-gradient(...)",
      });
    });
    expect(result.current.user?.id).toMatch(/^U[A-Z0-9]+$/);
    expect(result.current.user?.email).toBe("jet@example.com");
  });

  it("handleSignOut clears user and teams", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => {
      result.current.handleSignIn({ email: "a@b.com", name: "A", avatar: "" });
    });
    act(() => result.current.handleSignOut());
    expect(result.current.user).toBeNull();
    expect(result.current.ledTeam).toBeNull();
    expect(result.current.joinedTeam).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../AppStateContext'`.

- [ ] **Step 2.3: Create the provider**

Create `frontend/src/state/AppStateContext.tsx`. This lifts — unchanged — every piece of state and every handler currently in `App.tsx`. It drops `screen` / `setScreen` (routing replaces it), drops `rewardsFrom` (browser history replaces it), and drops `currentTaskId` (URL param replaces it).

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import { TASKS } from "../data";
import type { SuccessData, Task, Team, User } from "../types";

type RawUser = Pick<User, "email" | "name" | "avatar">;

export interface AppState {
  user: User | null;
  tasks: Task[];
  ledTeam: Team | null;
  joinedTeam: Team | null;
  successData: SuccessData | null;
  profileComplete: boolean;

  setSuccessData: (d: SuccessData | null) => void;

  handleSignIn: (raw: RawUser) => void;
  handleSignOut: () => void;
  handleProfileComplete: (profile: Partial<User>) => void;
  handleProfileUpdate: (profile: Partial<User>) => void;

  joinTeam: (team: Omit<Team, "role">) => void;
  leaveLedTeam: () => void;
  leaveJoinedTeam: () => void;
  approveRequest: (reqId: string) => void;
  rejectRequest: (reqId: string) => void;
  renameTeam: (alias: string) => void;
  simulateJoinApproved: () => void; // demo-only; remove when Phase 4 wires real events

  completeTask: (id: number) => void;
}

const AppStateCtx = createContext<AppState | null>(null);

function userIdFromEmail(email: string): string {
  return (
    "U" +
    (email || "guest@x.com")
      .split("@")[0]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6)
      .padEnd(4, "0")
  );
}

export function AppStateProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: User | null;
}) {
  const [user, setUser] = useState<User | null>(() => initialUser ?? null);
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [ledTeam, setLedTeam] = useState<Team | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<Team | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const profileComplete = !!user?.zhName;

  const syncTeamTask = (led: Team | null, joined: Team | null) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === 3);
      if (idx < 0) return prev;
      const t = prev[idx];
      const cap = t.cap || 6;
      const ledTotal = led ? led.members.length + 1 : 0;
      const joinedTotal =
        joined && joined.status === "approved" ? (joined.currentCount || 0) + 1 : 0;
      const total = Math.max(ledTotal, joinedTotal);
      const complete = total >= cap;
      const updated: Task = {
        ...t,
        status: !led && !joined ? "todo" : complete ? "completed" : "in_progress",
        progress: Math.min(1, total / cap),
        teamProgress: led || joined ? { total, cap, ledTotal, joinedTotal } : null,
      };
      const n = [...prev];
      n[idx] = updated;
      return n;
    });
  };

  const handleSignIn = (raw: RawUser) => {
    const uid = userIdFromEmail(raw.email);
    setUser({ ...raw, id: uid });
  };

  const handleSignOut = () => {
    setUser(null);
    setLedTeam(null);
    setJoinedTeam(null);
  };

  const handleProfileComplete = (profile: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const merged: User = {
        ...prev,
        name: profile.zhName || prev.name,
        zhName: profile.zhName,
        enName: profile.enName,
        nickname: profile.nickname,
        phone: profile.phone,
        phoneCode: profile.phoneCode,
        lineId: profile.lineId,
        telegramId: profile.telegramId,
        country: profile.country,
        location: profile.location,
      };
      const displayName = merged.name;
      const myTeam: Team = {
        id: "T-" + prev.id.replace(/^U/, ""),
        role: "leader",
        name: `${displayName}的團隊`,
        topic: "尚未指定主題",
        leader: {
          id: prev.id,
          name: displayName,
          avatar: "linear-gradient(135deg, #fed234, #fec701, #fec701)",
        },
        members: [],
        requests: [
          { id: "req1", name: "林詠瑜", avatar: "linear-gradient(135deg, #fed234, #fec701)" },
          { id: "req2", name: "陳志豪", avatar: "linear-gradient(135deg, #fec701, #B8A4E3)" },
          { id: "req3", name: "王美玲", avatar: "linear-gradient(135deg, #8AD4B0, #fec701)" },
        ],
      };
      setLedTeam(myTeam);
      syncTeamTask(myTeam, null);
      return merged;
    });
  };

  const handleProfileUpdate = (profile: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        name: profile.zhName || prev.name,
        zhName: profile.zhName,
        enName: profile.enName,
        nickname: profile.nickname,
        phone: profile.phone,
        phoneCode: profile.phoneCode,
        lineId: profile.lineId,
        telegramId: profile.telegramId,
        country: profile.country,
        location: profile.location,
      };
    });
  };

  const joinTeam = (teamData: Omit<Team, "role">) => {
    const newTeam: Team = { ...teamData, role: "member" };
    setJoinedTeam(newTeam);
    syncTeamTask(ledTeam, newTeam);
    setSuccessData({
      color: "#6dae4a",
      points: 0,
      bonus: `已向「${newTeam.name}」送出申請，等待組長審核`,
      title: "申請已送出！",
    });
  };

  const leaveLedTeam = () => {
    setLedTeam(null);
    syncTeamTask(null, joinedTeam);
  };
  const leaveJoinedTeam = () => {
    setJoinedTeam(null);
    syncTeamTask(ledTeam, null);
  };

  const approveRequest = (reqId: string) => {
    if (!ledTeam) return;
    const req = (ledTeam.requests || []).find((r) => r.id === reqId);
    if (!req) return;
    const updated: Team = {
      ...ledTeam,
      members: [...ledTeam.members, { id: req.id, name: req.name, avatar: req.avatar }],
      requests: (ledTeam.requests || []).filter((r) => r.id !== reqId),
    };
    setLedTeam(updated);
    syncTeamTask(updated, joinedTeam);
    if (updated.members.length + 1 >= 6) {
      const t3 = tasks.find((x) => x.id === 3);
      if (t3) {
        setSuccessData({
          color: t3.color,
          points: t3.points,
          bonus: t3.bonus,
          title: "組隊完成！",
        });
      }
    }
  };

  const rejectRequest = (reqId: string) => {
    if (!ledTeam) return;
    setLedTeam({
      ...ledTeam,
      requests: (ledTeam.requests || []).filter((r) => r.id !== reqId),
    });
  };

  const renameTeam = (alias: string) => {
    if (!ledTeam) return;
    setLedTeam({ ...ledTeam, alias });
  };

  const simulateJoinApproved = () => {
    if (!joinedTeam || joinedTeam.status !== "pending") return;
    const approved: Team = { ...joinedTeam, status: "approved" };
    setJoinedTeam(approved);
    syncTeamTask(ledTeam, approved);
  };

  const completeTask = (id: number) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const t = tasks[idx];
    const updated: Task = {
      ...t,
      status: "completed",
      steps: (t.steps || []).map((s) => ({ ...s, done: true })),
      progress: 1,
    };
    const newTasks = [...tasks];
    newTasks[idx] = updated;
    setTasks(newTasks);
    setSuccessData({ color: t.color, points: t.points, bonus: t.bonus });
  };

  const value: AppState = {
    user,
    tasks,
    ledTeam,
    joinedTeam,
    successData,
    profileComplete,
    setSuccessData,
    handleSignIn,
    handleSignOut,
    handleProfileComplete,
    handleProfileUpdate,
    joinTeam,
    leaveLedTeam,
    leaveJoinedTeam,
    approveRequest,
    rejectRequest,
    renameTeam,
    simulateJoinApproved,
    completeTask,
  };

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error("useAppState must be used inside <AppStateProvider>");
  return ctx;
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS, 3 tests.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/src/state/AppStateContext.tsx frontend/src/state/__tests__/AppStateContext.test.tsx
git commit -m "feat: add AppStateProvider bridging App.tsx state for routing"
```

---

## Task 3: Scaffold router and mount in `main.tsx`

Stand up a minimal router with `__root` + `/` landing route only. The rest of the routes get added in later tasks. `App.tsx` still exists but is no longer mounted — the router's `/` route renders `LandingScreen` directly.

**Files:**
- Create: `frontend/src/router.ts`
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/index.tsx`
- Create: `frontend/src/routes/__tests__/routing.test.tsx`
- Create: `frontend/src/test/renderRoute.tsx` — shared test helper used by every routing test below.
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/screens/LandingScreen.tsx`

- [ ] **Step 3.1: Create the shared test helper**

Create `frontend/src/test/renderRoute.tsx`. This helper owns the router-context plumbing so individual tests stay focused on assertions. Crucially, it seeds auth state **synchronously** via `AppStateProvider`'s `initialUser` prop (added in Task 2). A `useEffect`-based seed races the router's initial guard evaluation and ends up on `/`.

```tsx
import { useEffect } from "react";
import { render } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { AppStateProvider, useAppState } from "../state/AppStateContext";
import { createAppRouter } from "../router";
import type { User } from "../types";

export type SeedAuth = "guest" | "authed-incomplete" | "authed-complete";

function userForSeed(seed: SeedAuth): User | null {
  if (seed === "guest") return null;
  const base: User = {
    id: "UTEST00",
    email: "a@b.com",
    name: "A",
    avatar: "",
  };
  return seed === "authed-complete" ? { ...base, zhName: "甲" } : base;
}

function Shell({ router }: { router: ReturnType<typeof createAppRouter> }) {
  const { user, profileComplete } = useAppState();
  useEffect(() => {
    router.invalidate();
  }, [router, user, profileComplete]);
  return (
    <RouterProvider
      router={router}
      context={{
        auth: { user: user ? { id: user.id } : null, profileComplete },
      }}
    />
  );
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
}

export function renderRoute(
  path: string,
  opts: { seed?: SeedAuth } = {},
): RenderRouteResult {
  const seed = opts.seed ?? "guest";
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    initialContext: {
      auth: {
        user: seed === "guest" ? null : { id: "UTEST00" },
        profileComplete: seed === "authed-complete",
      },
    },
  });
  const dom = render(
    <AppStateProvider initialUser={userForSeed(seed)}>
      <Shell router={router} />
    </AppStateProvider>,
  );
  return { router, dom };
}
```

The `createAppRouter` signature gets an optional `initialContext` override (for tests) in Step 3.6 — adjust accordingly.

- [ ] **Step 3.2: Write the failing test**

Create `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute } from "../../test/renderRoute";

describe("router scaffolding", () => {
  it("renders the landing screen at /", async () => {
    renderRoute("/");
    await waitFor(() => {
      expect(screen.getByText("金富有志工")).toBeInTheDocument();
    });
  });
});
```

(The text `金富有志工` is the landing heading — open `frontend/src/screens/LandingScreen.tsx` first and substitute the actual heading string if different.)

- [ ] **Step 3.3: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../../router'`.

- [ ] **Step 3.4: Create `__root.tsx`**

Create `frontend/src/routes/__root.tsx`:
```tsx
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import GlobalStyles from "../ui/GlobalStyles";
import FormSuccessOverlay from "../ui/FormSuccessOverlay";
import { useAppState } from "../state/AppStateContext";

export interface RouterContext {
  auth: {
    user: { id: string } | null;
    profileComplete: boolean;
  };
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
  const { successData, setSuccessData } = useAppState();
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
      {successData && (
        <FormSuccessOverlay {...successData} onDone={() => setSuccessData(null)} />
      )}
    </div>
  );
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});
```

- [ ] **Step 3.5: Create `routes/index.tsx`**

Create `frontend/src/routes/index.tsx`:
```tsx
import { createRoute, useNavigate } from "@tanstack/react-router";
import LandingScreen from "../screens/LandingScreen";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function LandingRoute() {
  const navigate = useNavigate();
  const { user, profileComplete } = useAppState();
  const handleStart = () => {
    if (!user) navigate({ to: "/sign-in" });
    else if (!profileComplete) navigate({ to: "/welcome" });
    else navigate({ to: "/home" });
  };
  return <LandingScreen onStart={handleStart} />;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingRoute,
});
```

- [ ] **Step 3.6: Create `router.ts`**

Create `frontend/src/router.ts`:
```ts
import {
  createRouter,
  createBrowserHistory,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { rootRoute, type RouterContext } from "./routes/__root";
import { indexRoute } from "./routes/index";

const routeTree = rootRoute.addChildren([indexRoute]);

export function createAppRouter(opts?: {
  history?: RouterHistory;
  initialContext?: RouterContext;
}) {
  return createRouter({
    routeTree,
    history: opts?.history ?? createBrowserHistory(),
    defaultPreload: "intent",
    context: opts?.initialContext ?? {
      auth: { user: null, profileComplete: false },
    },
  });
}

export const router = createAppRouter();

// Typed history state — lets us use `state: { fromDetail: true }` without `as never`.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface HistoryState {
    fromDetail?: boolean;
    fromProfile?: boolean;
  }
}

export type AppRouter = AnyRouter;
```

- [ ] **Step 3.7: Mount the router in `main.tsx`**

Replace `frontend/src/main.tsx`:
```tsx
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { router } from "./router";

function AppShell() {
  const { user, profileComplete } = useAppState();
  // Re-evaluate route guards when auth state changes (e.g., sign-out mid-session).
  useEffect(() => {
    router.invalidate();
  }, [user, profileComplete]);
  return (
    <RouterProvider
      router={router}
      context={{ auth: { user: user ? { id: user.id } : null, profileComplete } }}
    />
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  </StrictMode>,
);
```

- [ ] **Step 3.8: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (2 describe blocks, 4 tests total: the 3 AppStateContext tests + 1 routing test).

- [ ] **Step 3.9: Dev-server smoke check**

Run: `pnpm dev` (background) → open `http://localhost:5173/` in a browser (or verify with `curl -s http://localhost:5173/ | grep -o '金富有志工'`).
Expected: landing page renders; "开启" button navigates to `/sign-in` (which currently renders nothing — acceptable until Task 5).

Kill the dev server.

- [ ] **Step 3.10: Commit**

```bash
git add frontend/src/router.ts frontend/src/routes/__root.tsx frontend/src/routes/index.tsx frontend/src/routes/__tests__/routing.test.tsx frontend/src/test/renderRoute.tsx frontend/src/main.tsx
git commit -m "feat: scaffold TanStack Router with root layout and landing route"
```

---

## Task 4: Add `_authed` layout with auth guard

The `_authed` layout has no URL segment. Its `beforeLoad` redirects guests to `/` and incomplete-profile users to `/welcome`.

**Files:**
- Create: `frontend/src/routes/_authed.tsx`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 4.1: Write failing tests**

Append to `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
describe("_authed layout", () => {
  it("is defined with the expected id", async () => {
    const { authedRoute } = await import("../_authed");
    expect(authedRoute.id).toContain("_authed");
  });
});
```
(Guard-redirect behavior is tested end-to-end in Task 6 once an authed child route exists.)

- [ ] **Step 4.2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../_authed'`.

- [ ] **Step 4.3: Create `_authed.tsx`**

Create `frontend/src/routes/_authed.tsx`:
```tsx
import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/" });
    }
    if (!context.auth.profileComplete) {
      throw redirect({ to: "/welcome" });
    }
  },
  component: Outlet,
});
```

- [ ] **Step 4.4: Wire the layout into the route tree**

Modify `frontend/src/router.ts` to register the layout (still no children yet):
```ts
import {
  createRouter,
  createBrowserHistory,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { authedRoute } from "./routes/_authed";

const routeTree = rootRoute.addChildren([indexRoute, authedRoute.addChildren([])]);

export function createAppRouter(opts?: { history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history: opts?.history ?? createBrowserHistory(),
    defaultPreload: "intent",
    context: {
      auth: { user: null, profileComplete: false },
    },
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export type AppRouter = AnyRouter;
```

- [ ] **Step 4.5: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4.6: Commit**

```bash
git add frontend/src/routes/_authed.tsx frontend/src/router.ts frontend/src/routes/__tests__/routing.test.tsx
git commit -m "feat: add _authed layout route with auth guard"
```

---

## Task 5: Migrate `/sign-in` and `/welcome` public routes

Both routes render pre-existing screens with small adjustments: no longer take callback props; use `useAppState()` + `useNavigate()`.

**Files:**
- Create: `frontend/src/routes/sign-in.tsx`
- Create: `frontend/src/routes/welcome.tsx`
- Modify: `frontend/src/screens/GoogleAuthScreen.tsx`
- Modify: `frontend/src/screens/ProfileSetupForm.tsx`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 5.1: Write failing tests**

Append to `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
describe("public routes", () => {
  it("renders sign-in at /sign-in", async () => {
    renderRoute("/sign-in");
    // GoogleAuthScreen.tsx:98 renders "選擇帳號" (Traditional — present in source).
    await waitFor(() => {
      expect(screen.getByText("選擇帳號")).toBeInTheDocument();
    });
  });

  it("guest visiting /welcome is redirected to /sign-in", async () => {
    const { router } = renderRoute("/welcome");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — routes not defined.

- [ ] **Step 5.3: Create `sign-in.tsx`**

Create `frontend/src/routes/sign-in.tsx`:
```tsx
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import GoogleAuthScreen from "../screens/GoogleAuthScreen";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function SignInRoute() {
  const navigate = useNavigate();
  const { handleSignIn } = useAppState();
  return (
    <GoogleAuthScreen
      onCancel={() => navigate({ to: "/" })}
      onSuccess={(raw) => {
        // After sign-in, the auth effect in main.tsx's AppShell (router.invalidate)
        // re-runs the guard on /sign-in, which redirects to /welcome (incomplete
        // profile) or /home (complete). No explicit navigate needed — and doing
        // both would race.
        handleSignIn(raw);
      }}
    />
  );
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      throw redirect({ to: context.auth.profileComplete ? "/home" : "/welcome" });
    }
  },
  component: SignInRoute,
});
```

- [ ] **Step 5.4: Create `welcome.tsx`**

Create `frontend/src/routes/welcome.tsx`:
```tsx
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function WelcomeRoute() {
  const navigate = useNavigate();
  const { user, handleProfileComplete, handleSignOut } = useAppState();
  return (
    <ProfileSetupForm
      user={user}
      onCancel={() => {
        handleSignOut();
        navigate({ to: "/" });
      }}
      onSubmit={(profile) => {
        handleProfileComplete(profile);
        navigate({ to: "/home" });
      }}
    />
  );
}

export const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: "/sign-in" });
    if (context.auth.profileComplete) throw redirect({ to: "/home" });
  },
  component: WelcomeRoute,
});
```

- [ ] **Step 5.5: Register routes in `router.ts`**

Modify `frontend/src/router.ts`:
```ts
import { signInRoute } from "./routes/sign-in";
import { welcomeRoute } from "./routes/welcome";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  authedRoute.addChildren([]),
]);
```

- [ ] **Step 5.6: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (5 routing tests now).

- [ ] **Step 5.7: Commit**

```bash
git add frontend/src/routes/sign-in.tsx frontend/src/routes/welcome.tsx frontend/src/router.ts frontend/src/routes/__tests__/routing.test.tsx
git commit -m "feat: add /sign-in and /welcome public routes"
```

---

## Task 6: Migrate `/home`, `/leaderboard`, `/rewards` (simple authed routes)

Each of these renders a single screen with no URL params. The screens currently take prop callbacks; change them to read from context + router.

**Files:**
- Create: `frontend/src/routes/_authed.home.tsx`
- Create: `frontend/src/routes/_authed.leaderboard.tsx`
- Create: `frontend/src/routes/_authed.rewards.tsx`
- Modify: `frontend/src/screens/HomeScreen.tsx`
- Modify: `frontend/src/screens/RankScreen.tsx`
- Modify: `frontend/src/screens/RewardsScreen.tsx`
- Modify: `frontend/src/ui/BottomNav.tsx` (bottom-nav buttons currently take `onNavigate` — switch to `useNavigate()`)
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 6.1: Write failing tests**

Append to `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
describe("authed simple routes", () => {
  it("renders home at /home when authed + complete", async () => {
    renderRoute("/home", { seed: "authed-complete" });
    // BottomNav.tsx:55 renders "首页" (Simplified) — match exactly.
    await waitFor(() => {
      expect(screen.getByText("首页")).toBeInTheDocument();
    });
  });

  it("redirects guest /home to /", async () => {
    const { router } = renderRoute("/home");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  it("redirects authed-incomplete /home to /welcome", async () => {
    const { router } = renderRoute("/home", { seed: "authed-incomplete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/welcome");
    });
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `/home` route not defined.

- [ ] **Step 6.3: Refactor `HomeScreen.tsx`**

Replace `frontend/src/screens/HomeScreen.tsx` props with context:
```tsx
// at the top, replace the old imports + Props type
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";
import { getEffectiveStatus, fs } from "../utils";
import BottomNav from "../ui/BottomNav";
import TaskCard from "./TaskCard";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { user, tasks, handleSignOut } = useAppState();
  const onSignOut = () => {
    handleSignOut();
    navigate({ to: "/" });
  };
  const onOpenTask = (id: number) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: String(id) } });
  // ... rest of the file stays unchanged (remove `tasksProp || TASKS` fallback; use `tasks` directly)
}
```
Delete the `type Props` block, the destructuring (`{ user, tasks: tasksProp, ... }`), and the `const tasks = tasksProp || TASKS;` fallback. Keep all rendering logic below unchanged. Remove the unused `TASKS` import.

Anywhere the current code calls `onNavigate("rewards")`, replace with `navigate({ to: "/rewards" })`; `onNavigate("tasks")` → `navigate({ to: "/tasks" })`; etc.

- [ ] **Step 6.4: Refactor `RankScreen.tsx`**

- Delete the `type Props` / `Props` interface and destructuring.
- Import `useNavigate` from `@tanstack/react-router` and `useAppState` from `../state/AppStateContext`. Inside the component: `const navigate = useNavigate(); const { user, tasks } = useAppState();`
- Replace any `onNavigate("<target>")` call with `navigate({ to: "/<target>" })` (using the updated URL mapping — e.g. `onNavigate("rank")` is no longer possible; any self-nav to leaderboard is `"/leaderboard"`).
- Remove the `tasksProp || TASKS` fallback; use `tasks` from context directly.
- `RankScreen` does not have an `onBack` prop; skip any back-button refactor here.

- [ ] **Step 6.4b: Refactor `RewardsScreen.tsx`**

- Delete the `type Props` / `Props` interface and destructuring.
- Import `useNavigate`, `useRouter` from `@tanstack/react-router` and `useAppState`.
- Replace the `onBack` prop with a hook-driven back: `const router = useRouter(); const onBack = () => router.history.back();`.
- Remove the `tasksProp || TASKS` fallback; use `tasks` from context.

- [ ] **Step 6.5: Refactor `BottomNav.tsx`**

Current signature: `{ current: ScreenId; muted: string; onNavigate: (screen: ScreenId) => void }` with ITEMS keyed by `"home" | "tasks" | "rank" | "me"`. Active state must stay driven by the current URL, and the `muted` color must stay threaded from callers (it controls inactive-tab color). Replace the file with:

```tsx
import { useLocation, useNavigate } from "@tanstack/react-router";
import { fs } from "../utils";
import type { ReactNode } from "react";

type TabKey = "home" | "tasks" | "rank" | "me";

const TAB_TO_PATH: Record<TabKey, string> = {
  home: "/home",
  tasks: "/tasks",
  rank: "/leaderboard",
  me: "/me",
};

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </svg>
);
const TasksIcon = () => (
  <svg {...iconProps}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const RankIcon = () => (
  <svg {...iconProps}>
    <path d="M7 3h10v4a5 5 0 0 1-10 0V3z" />
    <path d="M7 5H4v2a3 3 0 0 0 3 3" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3" />
    <path d="M10 14h4v4h-4z" />
    <path d="M8 21h8" />
  </svg>
);
const MeIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const ITEMS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: "home", label: "首页", icon: <HomeIcon /> },
  { key: "tasks", label: "任务", icon: <TasksIcon /> },
  { key: "rank", label: "排行", icon: <RankIcon /> },
  { key: "me", label: "我的", icon: <MeIcon /> },
];

export default function BottomNav({ muted }: { muted: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 16px 18px",
        background: "var(--card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(254,210,52,0.25)",
      }}
    >
      {ITEMS.map((n) => {
        const path = TAB_TO_PATH[n.key];
        // Active when the current path is the tab's path or a descendant (e.g. /tasks/3 keeps "任务" active).
        const active = pathname === path || pathname.startsWith(path + "/");
        return (
          <button
            key={n.key}
            type="button"
            aria-label={n.label}
            aria-current={active ? "page" : undefined}
            onClick={() => navigate({ to: path })}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
              color: active ? "#fec701" : muted,
              border: "none",
              background: "transparent",
              padding: 0,
              font: "inherit",
            }}
          >
            <div style={{ display: "inline-flex", lineHeight: 1 }}>{n.icon}</div>
            <div style={{ fontSize: fs(10), fontWeight: active ? 700 : 500 }}>{n.label}</div>
          </button>
        );
      })}
    </div>
  );
}
```

Callers of `BottomNav` drop `current` and `onNavigate`; keep the `muted` prop they already pass.

- [ ] **Step 6.6: Create the three route files**

Create `frontend/src/routes/_authed.home.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import HomeScreen from "../screens/HomeScreen";
import { authedRoute } from "./_authed";

export const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/home",
  component: HomeScreen,
});
```

Create `frontend/src/routes/_authed.leaderboard.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import RankScreen from "../screens/RankScreen";
import { authedRoute } from "./_authed";

export const leaderboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/leaderboard",
  component: RankScreen,
});
```

Create `frontend/src/routes/_authed.rewards.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import RewardsScreen from "../screens/RewardsScreen";
import { authedRoute } from "./_authed";

export const rewardsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/rewards",
  component: RewardsScreen,
});
```

- [ ] **Step 6.7: Wire children in `router.ts`**

Modify the `authedRoute.addChildren([...])` call:
```ts
import { homeRoute } from "./routes/_authed.home";
import { leaderboardRoute } from "./routes/_authed.leaderboard";
import { rewardsRoute } from "./routes/_authed.rewards";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  authedRoute.addChildren([homeRoute, leaderboardRoute, rewardsRoute]),
]);
```

- [ ] **Step 6.8: Run tests + build**

```bash
pnpm test
pnpm build
```
Expected: tests PASS; `tsc -b && vite build` succeeds (type errors here will be from lingering prop callers — fix them by removing the removed props).

- [ ] **Step 6.9: Commit**

```bash
git add frontend/src/routes/_authed.home.tsx frontend/src/routes/_authed.leaderboard.tsx frontend/src/routes/_authed.rewards.tsx frontend/src/router.ts frontend/src/screens/HomeScreen.tsx frontend/src/screens/RankScreen.tsx frontend/src/screens/RewardsScreen.tsx frontend/src/ui/BottomNav.tsx frontend/src/routes/__tests__/routing.test.tsx
git commit -m "feat: migrate /home, /leaderboard, /rewards to router"
```

---

## Task 7: Migrate `/tasks`, `/tasks/:taskId`, `/tasks/:taskId/start`

The task-flow routes include the form cold-load redirect. When navigating to the form, set a history-state sentinel; the form's `beforeLoad` reads it.

**Files:**
- Create: `frontend/src/routes/_authed.tasks.tsx`
- Create: `frontend/src/routes/_authed.tasks.$taskId.tsx`
- Create: `frontend/src/routes/_authed.tasks.$taskId.start.tsx`
- Modify: `frontend/src/screens/TasksScreen.tsx`
- Modify: `frontend/src/screens/TaskDetailScreen.tsx`
- Modify: `frontend/src/screens/TaskCard.tsx`
- Modify: `frontend/src/screens/InterestForm.tsx`, `TicketForm.tsx`, `TeamForm.tsx` (only if they currently take `onCancel`; if so, they'll take it as a prop from the route wrapper below)
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 7.1: Write failing tests**

Append to `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
describe("task routes", () => {
  it("renders task detail at /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3");
    });
    // TASKS[2].title is "組隊挑戰" (Traditional — present in data.ts).
    await waitFor(() => {
      expect(screen.getByText("組隊挑戰")).toBeInTheDocument();
    });
  });

  it("redirects /tasks/3/start on cold load to /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3/start", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3");
    });
  });
});
```

- [ ] **Step 7.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 7.3: Refactor `TasksScreen.tsx`**

Drop `type Props`, `tasksProp || TASKS` fallback, and `onNavigate`/`onOpenTask`. Inside the component:
```tsx
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";

export default function TasksScreen() {
  const navigate = useNavigate();
  const { tasks } = useAppState();
  const onOpenTask = (id: number) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: String(id) } });
  // rest unchanged
}
```

- [ ] **Step 7.4: Refactor `TaskDetailScreen.tsx`**

Read `taskId` from URL params via the route's own `useParams()` (avoids brittle route-ID strings). `HistoryState` augmentation is added to `router.ts` in Step 3.6, so the `state` object is type-safe without `as never`.

```tsx
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";
import { taskDetailRoute } from "../routes/_authed.tasks.$taskId";

export default function TaskDetailScreen() {
  const navigate = useNavigate();
  const { tasks } = useAppState();
  const { taskId } = taskDetailRoute.useParams();
  const id = Number(taskId);
  const onBack = () => navigate({ to: "/tasks" });
  const onOpenTask = (nextId: number) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: String(nextId) } });
  const onStartTask = (forId: number) =>
    navigate({
      to: "/tasks/$taskId/start",
      params: { taskId: String(forId) },
      state: { fromDetail: true },
    });
  const onGoMe = () => navigate({ to: "/me" });
  // rest unchanged — pass `id` where `taskId` prop was used
}
```

- [ ] **Step 7.5: Refactor `TaskCard.tsx`**

If it reads `onOpenTask` as a prop, keep that — it's called by its parent (`TasksScreen`, `HomeScreen`). No router access inside TaskCard. Just drop the `tasksProp || TASKS` fallback if present.

- [ ] **Step 7.6: Create route files**

`frontend/src/routes/_authed.tasks.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import TasksScreen from "../screens/TasksScreen";
import { authedRoute } from "./_authed";

export const tasksRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks",
  component: TasksScreen,
});
```

`frontend/src/routes/_authed.tasks.$taskId.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import { tasksRoute } from "./_authed.tasks";

export const taskDetailRoute = createRoute({
  getParentRoute: () => tasksRoute,
  path: "/$taskId",
  component: TaskDetailScreen,
});
```

Note: the parent is `tasksRoute` here, making the full path `/tasks/$taskId`.

`frontend/src/routes/_authed.tasks.$taskId.start.tsx`:
```tsx
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import InterestForm from "../screens/InterestForm";
import TicketForm from "../screens/TicketForm";
import TeamForm from "../screens/TeamForm";
import { useAppState } from "../state/AppStateContext";
import { taskDetailRoute } from "./_authed.tasks.$taskId";

const SUPPORTED_TASK_IDS = new Set(["1", "2", "3"]);

function StartRoute() {
  const navigate = useNavigate();
  const { taskId } = taskStartRoute.useParams();
  const id = Number(taskId);
  const { completeTask, joinTeam } = useAppState();
  const goDetail = (forId: number) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: String(forId) } });

  if (id === 1) {
    return (
      <InterestForm
        onCancel={() => goDetail(1)}
        onSubmit={() => {
          completeTask(1);
          goDetail(1);
        }}
      />
    );
  }
  if (id === 2) {
    return (
      <TicketForm
        onCancel={() => goDetail(2)}
        onSubmit={() => {
          completeTask(2);
          goDetail(2);
        }}
      />
    );
  }
  // id === 3 — guaranteed by beforeLoad's SUPPORTED_TASK_IDS check.
  return (
    <TeamForm
      onCancel={() => navigate({ to: "/me" })}
      onSubmit={(team) => {
        joinTeam(team);
        navigate({ to: "/me" });
      }}
    />
  );
}

export const taskStartRoute = createRoute({
  getParentRoute: () => taskDetailRoute,
  path: "/start",
  beforeLoad: ({ location, params }) => {
    if (!SUPPORTED_TASK_IDS.has(params.taskId)) {
      throw redirect({ to: "/tasks/$taskId", params });
    }
    if (!location.state.fromDetail) {
      throw redirect({ to: "/tasks/$taskId", params });
    }
  },
  component: StartRoute,
});
```

- [ ] **Step 7.7: Wire into router tree**

Modify `router.ts`:
```ts
import { tasksRoute } from "./routes/_authed.tasks";
import { taskDetailRoute } from "./routes/_authed.tasks.$taskId";
import { taskStartRoute } from "./routes/_authed.tasks.$taskId.start";

// authed children list:
authedRoute.addChildren([
  homeRoute,
  tasksRoute.addChildren([taskDetailRoute.addChildren([taskStartRoute])]),
  leaderboardRoute,
  rewardsRoute,
]);
```

- [ ] **Step 7.8: Also wire the "build team" entry from `MyScreen`**

Cross-task reference used in Task 8. When `MyScreen` is migrated, its "建立隊伍" button becomes:
```tsx
navigate({
  to: "/tasks/$taskId/start",
  params: { taskId: "3" },
  state: { fromDetail: true },
});
```
Noted here so Task 8 doesn't forget the sentinel.

- [ ] **Step 7.9: Run tests + build**

```bash
pnpm test
pnpm build
```
Expected: PASS / succeeds.

- [ ] **Step 7.10: Commit**

```bash
git add \
  frontend/src/routes/_authed.tasks.tsx \
  frontend/src/routes/_authed.tasks.\$taskId.tsx \
  frontend/src/routes/_authed.tasks.\$taskId.start.tsx \
  frontend/src/router.ts \
  frontend/src/screens/TasksScreen.tsx \
  frontend/src/screens/TaskDetailScreen.tsx \
  frontend/src/screens/TaskCard.tsx \
  frontend/src/routes/__tests__/routing.test.tsx
git commit -m "feat: migrate /tasks, /tasks/:id, /tasks/:id/start to router"
```

---

## Task 8: Migrate `/me`, `/me/profile`, `/me/profile/edit`

**Files:**
- Create: `frontend/src/routes/_authed.me.tsx`
- Create: `frontend/src/routes/_authed.me.profile.tsx`
- Create: `frontend/src/routes/_authed.me.profile.edit.tsx`
- Modify: `frontend/src/screens/MyScreen.tsx`
- Modify: `frontend/src/screens/ProfileScreen.tsx`
- Modify: `frontend/src/router.ts`
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 8.1: Write failing tests**

Append to `frontend/src/routes/__tests__/routing.test.tsx`:
```tsx
describe("me routes", () => {
  it("renders my screen at /me", async () => {
    renderRoute("/me", { seed: "authed-complete" });
    await waitFor(() => {
      // BottomNav.tsx:58 renders "我的" (Simplified).
      expect(screen.getByText("我的")).toBeInTheDocument();
    });
  });

  it("renders profile view at /me/profile", async () => {
    renderRoute("/me/profile", { seed: "authed-complete" });
    // ProfileScreen shows an edit affordance — verify the actual string in the
    // source (ProfileScreen.tsx) and assert on it exactly. Grep for common
    // variants: "编辑个人资料", "编辑", "编辑资料".
    await waitFor(() => {
      expect(screen.queryByText(/编辑/)).not.toBeNull();
    });
  });

  it("cold-load /me/profile/edit redirects to /me/profile", async () => {
    const { router } = renderRoute("/me/profile/edit", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/me/profile");
    });
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL.

- [ ] **Step 8.3: Refactor `MyScreen.tsx`**

Drop all domain props; use context + navigate. Replace the build-team handler:
```tsx
const onBuildTeam = () =>
  navigate({
    to: "/tasks/$taskId/start",
    params: { taskId: "3" },
    state: { fromDetail: true },
  });
```
Replace `onNavigate("profile")` calls with `navigate({ to: "/me/profile" })`. Replace `onOpenTask(id)` with `navigate({ to: "/tasks/$taskId", params: { taskId: String(id) } })`. Replace `onSignOut` wrapper with `() => { handleSignOut(); navigate({ to: "/" }); }`.

- [ ] **Step 8.4: Refactor `ProfileScreen.tsx`**

Drop `onBack` / `onEdit` props; use navigate:
```tsx
import { useNavigate } from "@tanstack/react-router";
import { useAppState } from "../state/AppStateContext";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAppState();
  const onBack = () => navigate({ to: "/me" });
  const onEdit = () => navigate({ to: "/me/profile/edit" });
  // rest unchanged
}
```

- [ ] **Step 8.5: Create three route files**

`frontend/src/routes/_authed.me.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import MyScreen from "../screens/MyScreen";
import { authedRoute } from "./_authed";

export const meRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/me",
  component: MyScreen,
});
```

`frontend/src/routes/_authed.me.profile.tsx`:
```tsx
import { createRoute } from "@tanstack/react-router";
import ProfileScreen from "../screens/ProfileScreen";
import { meRoute } from "./_authed.me";

export const profileRoute = createRoute({
  getParentRoute: () => meRoute,
  path: "/profile",
  component: ProfileScreen,
});
```

`frontend/src/routes/_authed.me.profile.edit.tsx`:
```tsx
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useAppState } from "../state/AppStateContext";
import { profileRoute } from "./_authed.me.profile";

function ProfileEditRoute() {
  const navigate = useNavigate();
  const { user, handleProfileUpdate } = useAppState();
  return (
    <ProfileSetupForm
      user={user}
      initial={user}
      title="編輯個人資料"
      subtitle="更新你的基本資訊"
      submitLabel="儲存變更"
      onCancel={() => navigate({ to: "/me/profile" })}
      onSubmit={(profile) => {
        handleProfileUpdate(profile);
        navigate({ to: "/me/profile" });
      }}
    />
  );
}

export const profileEditRoute = createRoute({
  getParentRoute: () => profileRoute,
  path: "/edit",
  beforeLoad: ({ location }) => {
    if (!location.state.fromProfile) {
      throw redirect({ to: "/me/profile" });
    }
  },
  component: ProfileEditRoute,
});
```

And update `ProfileScreen.tsx`'s `onEdit` to pass the sentinel (type-safe via the `HistoryState` augmentation in `router.ts`):
```tsx
const onEdit = () =>
  navigate({ to: "/me/profile/edit", state: { fromProfile: true } });
```

- [ ] **Step 8.6: Wire into router tree**

```ts
import { meRoute } from "./routes/_authed.me";
import { profileRoute } from "./routes/_authed.me.profile";
import { profileEditRoute } from "./routes/_authed.me.profile.edit";

authedRoute.addChildren([
  homeRoute,
  tasksRoute.addChildren([taskDetailRoute.addChildren([taskStartRoute])]),
  leaderboardRoute,
  meRoute.addChildren([profileRoute.addChildren([profileEditRoute])]),
  rewardsRoute,
]);
```

- [ ] **Step 8.7: Run tests + build**

```bash
pnpm test
pnpm build
```

- [ ] **Step 8.8: Commit**

```bash
git add \
  frontend/src/routes/_authed.me.tsx \
  frontend/src/routes/_authed.me.profile.tsx \
  frontend/src/routes/_authed.me.profile.edit.tsx \
  frontend/src/router.ts \
  frontend/src/screens/MyScreen.tsx \
  frontend/src/screens/ProfileScreen.tsx \
  frontend/src/routes/__tests__/routing.test.tsx
git commit -m "feat: migrate /me, /me/profile, /me/profile/edit to router"
```

---

## Task 9: Delete `App.tsx` and finalize cleanup

With all routes in place, `App.tsx` is no longer referenced by `main.tsx` (it was removed in Task 3). Delete it plus now-unused symbols.

**Files:**
- Delete: `frontend/src/App.tsx`
- Modify: `frontend/src/types.ts`
- Modify: each screen file — verify no residual prop types or unused imports remain (e.g., `TASKS` from `../data` that was only used for the fallback)

- [ ] **Step 9.1: Delete `App.tsx`**

```bash
rm frontend/src/App.tsx
```

- [ ] **Step 9.2: Remove `ScreenId` export from `types.ts`**

Delete lines 123–135 of `frontend/src/types.ts` (the `ScreenId` union). Search the repo for remaining references:
```bash
grep -r "ScreenId" frontend/src
```
Expected: no matches.

- [ ] **Step 9.3: Audit screens for dead imports**

Run:
```bash
pnpm build
```
Any unused-import errors surface here. Fix each (typically dropping `TASKS` from `../data` where the fallback was removed, and any unused callback type imports).

- [ ] **Step 9.4: Tag the demo-only call**

`MyScreen` previously took `onSimulateJoinApproved` as a prop. In its migrated form it calls `simulateJoinApproved` from context. Ensure a single-line comment flags it as demo-only. Run:
```bash
grep -n "simulateJoinApproved" frontend/src/screens/MyScreen.tsx
```
At each call site, the line immediately above should read:
```tsx
// demo-only; remove when Phase 4 wires real team-membership events from the backend
```
If missing, add it.

- [ ] **Step 9.5: Run full verification**

```bash
pnpm test
pnpm lint
pnpm build
```
Expected: all pass.

- [ ] **Step 9.6: Commit**

```bash
git add -u frontend/src
git commit -m "refactor: delete App.tsx and ScreenId after router migration"
```

---

## Task 10: Full route-level test sweep

Add the remaining tests called out in the spec's **Testing** section and run manual smoke.

**Files:**
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`

- [ ] **Step 10.1: Landing CTA — all three branches**

Append:
```tsx
import userEvent from "@testing-library/user-event";

describe("landing CTA", () => {
  it("guest → /sign-in", async () => {
    const { router } = renderRoute("/");
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sign-in"));
  });

  it("authed + complete → /home", async () => {
    const { router } = renderRoute("/", { seed: "authed-complete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed + incomplete → /welcome", async () => {
    const { router } = renderRoute("/", { seed: "authed-incomplete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  });
});
```

- [ ] **Step 10.2: Guard sweep**

Append:
```tsx
describe("guard sweep", () => {
  it("authed complete visiting /sign-in → /home", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed complete visiting /welcome → /home", async () => {
    const { router } = renderRoute("/welcome", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed incomplete visiting /sign-in → /welcome", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-incomplete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  });
});
```

- [ ] **Step 10.3: Not-found, click-through, and history tests**

Append:
```tsx
describe("not found", () => {
  it("/tasks/999 renders the not-found component", async () => {
    renderRoute("/tasks/999", { seed: "authed-complete" });
    await waitFor(() => {
      expect(screen.getByText("找不到页面")).toBeInTheDocument();
    });
  });
});

describe("click-through: start task", () => {
  it("/tasks/3 → '開始任務' button → /tasks/3/start renders TeamForm", async () => {
    const { router } = renderRoute("/tasks/3", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3");
    });
    // TaskDetailScreen's CTA label is "開始任務" (Traditional — matches source).
    const startBtn = await screen.findByRole("button", { name: /開始任務/ });
    await userEvent.click(startBtn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3/start");
    });
  });
});

describe("history back", () => {
  it("memory history supports back() across /home → /tasks → /tasks/1 → back → /tasks", async () => {
    const { router } = renderRoute("/home", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
    await router.navigate({ to: "/tasks" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
    await router.navigate({ to: "/tasks/$taskId", params: { taskId: "1" } });
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks/1"));
    router.history.back();
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
  });
});
```

The codebase has mixed Simplified/Traditional copy (LandingScreen/BottomNav are Simplified; GoogleAuthScreen/data.ts task titles are Traditional). Always grep the source before asserting on Chinese text.

- [ ] **Step 10.4: Run full test suite**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 10.5: Manual smoke (completion gate)**

Run `pnpm dev` in one terminal. In a browser:
1. Open `http://localhost:5173/` — landing renders. Click "开启" → `/sign-in`.
2. Complete mock sign-in → ends on `/welcome`. Submit profile → `/home`.
3. Click every bottom-nav button: `首页`, `任务`, `排行`, `我的`. Each URL changes (`/home`, `/tasks`, `/leaderboard`, `/me`).
4. From `/home`, click a task card → URL is `/tasks/:id`. Click "開始任務" → URL is `/tasks/:id/start`. Submit or cancel. Back button works.
5. Reload on each of: `/home`, `/tasks`, `/tasks/1`, `/leaderboard`, `/me`, `/me/profile`, `/rewards`. Each page re-renders with state intact (auth state is still in-memory; you may land back on landing — that's expected until Phase 6).
6. Paste `/tasks/2/start` into a new tab → redirect to `/tasks/2`.
7. Paste `/rewards` in a new tab → visible. Click back arrow → does not crash.

Document any failure in a follow-up commit.

- [ ] **Step 10.6: Final commit**

```bash
git add frontend/src/routes/__tests__/routing.test.tsx
git commit -m "test: add landing CTA and guard sweep integration tests"
```

- [ ] **Step 10.7: Update the production launch plan**

Modify `docs/production-launch-plan.md` — mark Phase 3 items complete:
```diff
 ## Phase 3 — Routing
-- [ ] Replace `useState("screen")` with React Router or TanStack Router
-- [ ] Map screens to URLs (`/`, `/home`, `/tasks/:id`, `/me`, etc.)
-- [ ] Verify bookmarkable URLs and browser back/forward
+- [x] Replace `useState("screen")` with React Router or TanStack Router
+- [x] Map screens to URLs (`/`, `/home`, `/tasks/:id`, `/me`, etc.)
+- [x] Verify bookmarkable URLs and browser back/forward
```

```bash
git add docs/production-launch-plan.md
git commit -m "docs: mark Phase 3 routing complete"
```

---

## Completion criteria (from spec)

- [x] All 12 current screens reachable via their URL. → Tasks 3, 5, 6, 7, 8
- [x] Browser back/forward works across all transitions. → Task 10.4 manual smoke
- [x] Auth guards verified by route-level tests. → Tasks 4, 5, 6, 10.2
- [x] `pnpm build` passes. → Task 9.5
- [x] `pnpm test` passes. → Task 10.3
- [x] `pnpm lint` passes. → Task 9.5
- [x] Production launch plan Phase 3 items checkable. → Task 10.6
