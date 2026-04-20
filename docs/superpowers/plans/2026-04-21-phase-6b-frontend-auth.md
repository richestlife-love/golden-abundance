# Phase 6b — Frontend Auth Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke email-stub + `tokenStore` frontend auth path with `@supabase/supabase-js`. Sign-in becomes a single "Continue with Google" button that triggers Supabase's OAuth flow. Session lives in Supabase's managed localStorage entries (not `ga.token`). The existing 401-interceptor, `returnTo` flow, and optimistic-mutation invalidation map all survive unchanged — only the token source of truth moves.

**Prereqs:** Plan 6a merged. A working Supabase project dev URL + anon key available for local dev (can be the same Supabase project used in deployed envs — the anon key is public by design).

**Architecture:** `src/lib/supabase.ts` owns a singleton Supabase client with a test-overridable setter (mirrors the `setRouterRef` + `_setActiveQueryClient` patterns in the codebase). `apiFetch` reads the access token via `supabase.auth.getSession()` instead of a synchronous localStorage read. `AuthProvider` subscribes to Supabase's `onAuthStateChange` so React sees sign-in/out reactively. A new `/auth/callback` route handles Supabase's OAuth redirect (the SDK does the heavy lifting; the route just waits + navigates). `vercel.json` ships the CSP that locks network access to Supabase + Sentry + self.

**Tech Stack:** Vite 8, React 19, TanStack Router 1.168, TanStack Query 5.99, MSW 2.13, vitest 4.1, TypeScript 6, pnpm 10.33; new dep `@supabase/supabase-js` ^2.46.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §5 (Sub-plan 6b).

**Exit criteria:**
- `pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test` all green.
- `grep -rn "tokenStore\|ga.token\|postGoogleAuth\|postLogout" frontend/src` returns no matches.
- No file imports `./dev/demo-accounts.json` (the file is deleted).
- `vercel.json` present at `frontend/vercel.json` with the CSP headers from §5.5 of the design spec.
- Running `pnpm -C frontend build` emits a clean dist/; inspecting `frontend/dist/index.html` shows only bundled script sources (no inline `<script>` the CSP would reject).

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Supabase SDK version | `@supabase/supabase-js@^2.46` | Current stable; supports `signInWithOAuth` + `onAuthStateChange` API used here. |
| Client singleton pattern | Overridable holder (`getSupabaseClient()` + `setSupabaseClientForTesting()`) | Matches existing `setRouterRef` DI pattern; avoids `vi.mock()` fragility. |
| Session storage | Supabase SDK default (localStorage under `sb-<ref>-auth-token`) | Per §6 of design spec; avoids custom storage adapter. |
| Auto-refresh | On (SDK default) | Sessions refresh ~5 min before expiry without extra code. |
| OAuth redirect URL | `${window.location.origin}/auth/callback` | Matches Supabase Authentication → URL Configuration's additional-redirect list (set in 6a §0). |
| OAuth flow | `signInWithOAuth({ provider: 'google' })` | Redirect-based; works against any deploy target without popup/window-manipulation quirks. |
| `onAuthStateChange` handling | Subscribe in `AuthProvider`, dispatch to local `setSignedIn` | One React subscription per app lifetime. |
| Sign-out | `await supabase.auth.signOut()` *then* the existing cache-clear + router-navigate sequence | Local signout is purely client-side; SDK clears its own storage. |
| Demo-picker | Deleted outright, no dev-only fallback | Per §5.7 of design spec; local dev uses real Google against a dev Supabase project. |
| CSP location | `frontend/vercel.json` in this plan | Spec §5.5 puts it in 6b; 7a reuses the file. |

---

## File plan

Files created (C), modified (M), or deleted (D). Paths relative to repo root `/Users/Jet/Developer/golden-abundance-lite`.

### Frontend source

| Path | Action | Contents |
|---|---|---|
| `frontend/package.json` | M | Add `@supabase/supabase-js` (runtime dep) |
| `frontend/src/lib/supabase.ts` | C | Client singleton + test-friendly setter |
| `frontend/src/auth/session.tsx` | M | Rewrite `signIn` + `signOut` + `AuthProvider` |
| `frontend/src/auth/token.ts` | D | Gone — session lives in the Supabase client |
| `frontend/src/api/client.ts` | M | Async token lookup via Supabase session |
| `frontend/src/api/auth.ts` | D | `/auth/google` + `/auth/logout` endpoints gone |
| `frontend/src/routes/auth.callback.tsx` | C | Post-OAuth redirect handler |
| `frontend/src/routes/sign-in.tsx` | M | Async `beforeLoad`, single-button handler |
| `frontend/src/routes/_authed.tsx` | M | Async `beforeLoad` reads Supabase session |
| `frontend/src/routes/index.tsx` | M | Async auth check for initial route |
| `frontend/src/routes/welcome.tsx` | M | Async `beforeLoad` reads Supabase session |
| `frontend/src/router.ts` | M | Register `authCallbackRoute` in the route tree |
| `frontend/src/screens/GoogleAuthScreen.tsx` | M | Collapse to a single "Sign in with Google" button |
| `frontend/src/dev/demo-accounts.json` | D | Gone |
| `backend/src/backend/scripts/dump_demo_accounts.py` | D | Generator is gone |
| `justfile` | M | Delete `gen-demo-accounts` recipe |
| `frontend/.env.example` | M | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `frontend/vercel.json` | C | CSP + security headers + SPA rewrite |

### Frontend tests

| Path | Action | Contents |
|---|---|---|
| `frontend/src/test/setup.ts` | M | Install fake Supabase client in `beforeEach` |
| `frontend/src/test/supabase-mock.ts` | C | Controllable fake Supabase client for tests |
| `frontend/src/test/msw/handlers.ts` | M | Drop `/auth/google`, `/auth/logout`; add Supabase Auth REST handlers |
| `frontend/src/auth/__tests__/session.test.tsx` | M | Rewrite against fake Supabase client |
| `frontend/src/api/__tests__/client.test.ts` | M | 401 + token attachment tests use fake session |
| `frontend/src/test/renderRoute.tsx` | M | Seed the fake Supabase session when tests want an authed render |

---

## Section A — Supabase client singleton + env scaffolding

**Exit criteria:** `import { getSupabaseClient } from "./lib/supabase"` returns a working client; tests can swap it via `setSupabaseClientForTesting(fake)`.

### Task A1: Add the `@supabase/supabase-js` dependency

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

```bash
(cd frontend && pnpm add @supabase/supabase-js)
```

Expected: `package.json` gains `"@supabase/supabase-js": "^2.46.x"` under `dependencies` and `pnpm-lock.yaml` updates.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore(frontend): add @supabase/supabase-js (Phase 6b)"
```

### Task A2: Supabase client singleton

**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Write the failing test `frontend/src/lib/__tests__/supabase.test.ts`**

```typescript
import { describe, expect, it, afterEach } from "vitest";
import {
  getSupabaseClient,
  setSupabaseClientForTesting,
} from "../supabase";

afterEach(() => setSupabaseClientForTesting(null));

describe("getSupabaseClient", () => {
  it("returns a singleton client", () => {
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });

  it("returns the test override when set", () => {
    const fake = { auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseClientForTesting(fake as any);
    expect(getSupabaseClient()).toBe(fake);
  });

  it("falls back to the real client after reset", () => {
    const fake = { any: "thing" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseClientForTesting(fake as any);
    expect(getSupabaseClient()).toBe(fake);
    setSupabaseClientForTesting(null);
    expect(getSupabaseClient()).not.toBe(fake);
  });
});
```

- [ ] **Step 2: Run — expect ImportError**

```bash
pnpm -C frontend test src/lib/__tests__/supabase.test.ts
```

Expected: FAIL — `Cannot find module "../supabase"`.

- [ ] **Step 3: Create `frontend/src/lib/supabase.ts`**

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Module-level singleton + test-friendly override. Mirrors the
// `setRouterRef` / `_setActiveQueryClient` DI patterns elsewhere in
// src/ — avoids `vi.mock` fragility in tests.
let _real: SupabaseClient | null = null;
let _override: SupabaseClient | null = null;

function createReal(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set " +
        "(see frontend/.env.example).",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (_override) return _override;
  if (!_real) _real = createReal();
  return _real;
}

export function setSupabaseClientForTesting(
  client: SupabaseClient | null,
): void {
  _override = client;
}
```

- [ ] **Step 4: Update `frontend/.env.example`**

Full file:

```env
# Copy to `.env.local` and fill in values for local overrides.
# Vite loads `.env.local` (gitignored) on top of `.env` for all modes.

# Backend API origin for Vite's /api proxy. Defaults to http://localhost:8000.
VITE_API_BASE_URL=http://localhost:8000

# Dev server port (host side). Defaults to 5173.
VITE_PORT=5173

# Comma-separated list of hosts Vite will serve on (dev server `allowedHosts`).
# Needed when exposing the dev server via a tunnel such as ngrok.
VITE_ALLOWED_HOSTS=your-tunnel-host.ngrok-free.dev

# ngrok hostname used by `just tunnel` (read from .env.local by the justfile).
NGROK_HOST=your-tunnel-host.ngrok-free.dev

# Supabase project URL (the https://<ref>.supabase.co base URL).
VITE_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase anon key (public by design). From Supabase → Settings → API.
VITE_SUPABASE_ANON_KEY=eyJhbGci...paste-anon-key-here
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm -C frontend test src/lib/__tests__/supabase.test.ts
```

Expected: 3 tests pass. The "returns a singleton client" test needs env vars — if it fails with the "must be set" error, add a local `.env.test` that sets both (or adjust the test to skip real instantiation; the override-path tests don't depend on env). Preferred fix: set env in `frontend/.env.test` for CI.

Create `frontend/.env.test` (if not already present):

```env
VITE_SUPABASE_URL=https://test-ref.supabase.co
VITE_SUPABASE_ANON_KEY=test-anon-key-not-a-real-jwt
```

Re-run; expect pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/src/lib/__tests__/supabase.test.ts frontend/.env.example frontend/.env.test
git commit -m "feat(frontend): Supabase client singleton with test override (Phase 6b)"
```

### Task A3: Fake Supabase client for tests

**Files:**
- Create: `frontend/src/test/supabase-mock.ts`

- [ ] **Step 1: Create `frontend/src/test/supabase-mock.ts`**

```typescript
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

/** Minimal fake matching the surface src/ uses. Add fields on demand; don't speculate. */
export interface FakeSupabaseHandle {
  client: SupabaseClient;
  setSession: (session: Session | null) => void;
  signInCalls: Array<{ provider: string; redirectTo?: string }>;
  signOutCalls: number;
}

export function makeFakeSupabase(): FakeSupabaseHandle {
  let session: Session | null = null;
  const listeners = new Set<(event: string, s: Session | null) => void>();
  const handle: FakeSupabaseHandle = {
    client: null as unknown as SupabaseClient,
    signInCalls: [],
    signOutCalls: 0,
    setSession: (s) => {
      session = s;
      for (const l of listeners) l(s ? "SIGNED_IN" : "SIGNED_OUT", s);
    },
  };

  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
        listeners.add(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => listeners.delete(cb),
            },
          },
        };
      },
      signInWithOAuth: (args: { provider: string; options?: { redirectTo?: string } }) => {
        handle.signInCalls.push({
          provider: args.provider,
          redirectTo: args.options?.redirectTo,
        });
        return Promise.resolve({ data: { provider: args.provider, url: null }, error: null });
      },
      signOut: () => {
        handle.signOutCalls += 1;
        session = null;
        for (const l of listeners) l("SIGNED_OUT", null);
        return Promise.resolve({ error: null });
      },
    },
  } as unknown as SupabaseClient;

  handle.client = client;
  return handle;
}

/** Helper: minimal Session with a stable access_token for apiFetch tests. */
export function makeSession(accessToken = "test-access-token", user?: Partial<User>): Session {
  return {
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: user?.id ?? "11111111-2222-3333-4444-555555555555",
      email: user?.email ?? "jet@demo.ga",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User,
  } as Session;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/test/supabase-mock.ts
git commit -m "test(frontend): fake Supabase client helper (Phase 6b)"
```

---

## Section B — Rewire AuthProvider + apiFetch

**Exit criteria:** `AuthProvider` reflects Supabase session state; `apiFetch` pulls the access token from the Supabase session on each call; existing 401 interceptor flow unchanged.

### Task B1: Rewrite AuthProvider session test first

**Files:**
- Modify: `frontend/src/auth/__tests__/session.test.tsx`

- [ ] **Step 1: Replace the file with the new test shape**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../session";
import {
  makeFakeSupabase,
  makeSession,
  type FakeSupabaseHandle,
} from "../../test/supabase-mock";
import { setSupabaseClientForTesting } from "../../lib/supabase";
import { qk } from "../../queries/keys";

function probe(qc: QueryClient) {
  function Probe() {
    const { isSignedIn, signIn, signOut } = useAuth();
    return (
      <div>
        <div data-testid="signed">{String(isSignedIn)}</div>
        <button onClick={() => signIn()}>in</button>
        <button onClick={() => signOut()}>out</button>
      </div>
    );
  }
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

let fake: FakeSupabaseHandle;

beforeEach(() => {
  fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
});

afterEach(() => {
  setSupabaseClientForTesting(null);
});

describe("AuthProvider", () => {
  it("starts signed out when there is no Supabase session", async () => {
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("false"),
    );
  });

  it("starts signed in when Supabase already has a session", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("true"),
    );
  });

  it("signIn() calls supabase.auth.signInWithOAuth with Google + callback URL", async () => {
    const qc = new QueryClient();
    probe(qc);
    act(() => {
      screen.getByText("in").click();
    });
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    expect(fake.signInCalls[0].provider).toBe("google");
    expect(fake.signInCalls[0].redirectTo).toMatch(/\/auth\/callback$/);
  });

  it("signOut() calls supabase.auth.signOut and clears qk.me", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    qc.setQueryData(qk.me, { id: "x" });
    probe(qc);
    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("true"),
    );

    act(() => {
      screen.getByText("out").click();
    });

    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("false"),
    );
    expect(fake.signOutCalls).toBe(1);
    expect(qc.getQueryData(qk.me)).toBeUndefined();
  });

  it("reacts to external auth state changes (e.g. expiry from another tab)", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("true"),
    );

    act(() => {
      fake.setSession(null);
    });

    await waitFor(() =>
      expect(screen.getByTestId("signed")).toHaveTextContent("false"),
    );
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm -C frontend test src/auth/__tests__/session.test.tsx
```

Expected: multiple failures — `signIn("jet@demo.ga")`-style calls not supported, `tokenStore` still wired, etc.

### Task B2: Rewrite `session.tsx`

**Files:**
- Modify: `frontend/src/auth/session.tsx`
- Delete: `frontend/src/auth/token.ts`

- [ ] **Step 1: Full rewrite of `frontend/src/auth/session.tsx`**

```typescript
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { setSessionExpiredHandler } from "../api/client";
import { pushToast } from "../ui/toasts";
import { getRouterRef } from "../router";
import { getSupabaseClient } from "../lib/supabase";

export interface SignOutOpts {
  reason?: "expired" | "user";
  returnTo?: string;
}

interface AuthCtx {
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: (opts?: SignOutOpts) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

let inFlightSignOut = false;

// Module-level QueryClient holder, preserved from Phase 4c so the 401
// interceptor + module-level signOut fire without needing AuthProvider
// to be mounted.
let activeQueryClient: QueryClient | null = null;
export function _setActiveQueryClient(qc: QueryClient | null): void {
  activeQueryClient = qc;
}

export async function signOut(opts: SignOutOpts = {}): Promise<void> {
  if (inFlightSignOut) return;
  inFlightSignOut = true;
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();

    if (opts.reason === "expired") {
      pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
    }

    const router = getRouterRef();
    if (router) {
      await router.navigate({
        to: "/sign-in",
        search: opts.returnTo ? { returnTo: opts.returnTo } : {},
      });
    }
    // Cache clear last so in-flight queries don't refetch with the
    // (now-cleared) token mid-teardown.
    activeQueryClient?.clear();
  } finally {
    inFlightSignOut = false;
  }
}

setSessionExpiredHandler(({ returnTo: fromClient }) => {
  const router = getRouterRef();
  const returnTo =
    router?.state.location.pathname != null
      ? router.state.location.pathname + (router.state.location.searchStr ?? "")
      : fromClient;
  void signOut({ reason: "expired", returnTo });
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    _setActiveQueryClient(qc);
    return () => _setActiveQueryClient(null);
  }, [qc]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let cancelled = false;

    // Seed initial state from whatever Supabase already has persisted.
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });

    // Subscribe to every future session change (sign-in, refresh, cross-tab signout, explicit signout).
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    // Browser redirects; nothing to do here. Post-callback flow lives in
    // routes/auth.callback.tsx.
  }, []);

  const signOutFromCtx = useCallback(async (opts: SignOutOpts = {}) => {
    await signOut(opts);
    setSignedIn(false);
  }, []);

  return (
    <Ctx.Provider value={{ isSignedIn: signedIn, signIn, signOut: signOutFromCtx }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
```

- [ ] **Step 2: Delete `frontend/src/auth/token.ts`**

```bash
rm frontend/src/auth/token.ts
```

- [ ] **Step 3: Delete `frontend/src/auth/__tests__/token.test.ts`** (if present)

```bash
rm -f frontend/src/auth/__tests__/token.test.ts
```

- [ ] **Step 4: Run — session test**

```bash
pnpm -C frontend test src/auth/__tests__/session.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/ -A
git commit -m "refactor(frontend): AuthProvider uses Supabase client (Phase 6b)"
```

### Task B3: Async token lookup in `apiFetch`

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Rewrite `frontend/src/api/__tests__/client.test.ts` auth assertions**

Find the existing test that sets `tokenStore.set("...")` before calling `apiFetch`. Rewrite it to seed a Supabase session via the fake:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { apiFetch, setSessionExpiredHandler } from "../client";
import {
  makeFakeSupabase,
  makeSession,
  type FakeSupabaseHandle,
} from "../../test/supabase-mock";
import { setSupabaseClientForTesting } from "../../lib/supabase";

let fake: FakeSupabaseHandle;

beforeEach(() => {
  fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
});

afterEach(() => {
  setSupabaseClientForTesting(null);
});

describe("apiFetch", () => {
  it("attaches Authorization: Bearer <access_token> when signed in", async () => {
    fake.setSession(makeSession("abc.def.ghi"));
    const seen: string[] = [];
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seen.push(request.headers.get("authorization") ?? "");
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch("/me");
    expect(seen).toEqual(["Bearer abc.def.ghi"]);
  });

  it("sends no Authorization header when signed out", async () => {
    const seen: string[] = [];
    server.use(
      http.get("/api/v1/ping", ({ request }) => {
        seen.push(request.headers.get("authorization") ?? "");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/ping");
    expect(seen).toEqual([""]);
  });

  it("fires the session-expired handler on 401 and throws", async () => {
    fake.setSession(makeSession());
    const calls: Array<{ returnTo: string }> = [];
    setSessionExpiredHandler((o) => calls.push(o));

    server.use(
      http.get("/api/v1/me", () =>
        HttpResponse.json({ detail: "expired" }, { status: 401 }),
      ),
    );

    await expect(apiFetch("/me")).rejects.toThrow(/session expired/i);
    expect(calls).toHaveLength(1);
    expect(calls[0].returnTo).toMatch(/^\//);

    setSessionExpiredHandler(null);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (apiFetch still reads `tokenStore`)**

```bash
pnpm -C frontend test src/api/__tests__/client.test.ts
```

Expected: FAIL — `tokenStore` import missing, or tokens not attached.

- [ ] **Step 3: Rewrite `frontend/src/api/client.ts`**

```typescript
import { ApiError } from "./errors";
import { getSupabaseClient } from "../lib/supabase";

type SessionExpiredHandler = ((opts: { returnTo: string }) => void) | null;

let onSessionExpired: SessionExpiredHandler = null;

export function setSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

const BASE = "/api/v1";

async function currentAccessToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await currentAccessToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body != null) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    onSessionExpired?.({
      returnTo: window.location.pathname + window.location.search,
    });
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      // body wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

Note the small improvement: `Content-Type: application/json` is only attached when there's a body (addresses the Phase 4a tech-debt item about always-sent content-type on GETs).

- [ ] **Step 4: Delete `frontend/src/api/auth.ts`**

```bash
rm frontend/src/api/auth.ts
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm -C frontend test src/api/__tests__/client.test.ts src/auth/__tests__/session.test.tsx
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/ -A
git commit -m "refactor(frontend): apiFetch reads token from Supabase session (Phase 6b)"
```

---

## Section C — Route guards + OAuth callback

**Exit criteria:** `/auth/callback` receives the post-OAuth redirect and navigates on; `_authed.tsx` and `index.tsx` and `sign-in.tsx` switch to async `beforeLoad`s that read Supabase session state.

### Task C1: Auth callback route

**Files:**
- Create: `frontend/src/routes/auth.callback.tsx`
- Modify: `frontend/src/router.ts`

- [ ] **Step 1: Create `frontend/src/routes/auth.callback.tsx`**

```typescript
import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { rootRoute } from "./__root";
import { getSupabaseClient } from "../lib/supabase";

interface CallbackSearch {
  returnTo?: string;
}

function AuthCallbackRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" });

  useEffect(() => {
    // The Supabase SDK (createClient option `detectSessionInUrl: true`)
    // parses the access_token / refresh_token from the URL fragment on
    // construction and fires onAuthStateChange. By the time this effect
    // runs, the session is already installed — we just wait for the
    // next render then navigate.
    const supabase = getSupabaseClient();
    let cancelled = false;
    void (async () => {
      // Poll up to 5s — in practice getSession resolves on the first call
      // after the SDK finishes its URL-fragment parse.
      for (let i = 0; i < 50 && !cancelled; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: search.returnTo ?? "/" });
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!cancelled) {
        // Session never appeared — treat as failure.
        navigate({ to: "/sign-in" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, search.returnTo]);

  return (
    <div style={{ padding: 32, textAlign: "center", color: "var(--fg)" }}>
      正在完成登入⋯
    </div>
  );
}

export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  validateSearch: (raw: Record<string, unknown>): CallbackSearch => ({
    returnTo: typeof raw.returnTo === "string" ? raw.returnTo : undefined,
  }),
  component: AuthCallbackRoute,
});
```

- [ ] **Step 2: Register the route in `frontend/src/router.ts`**

Add to the imports block:

```typescript
import { authCallbackRoute } from "./routes/auth.callback";
```

Add `authCallbackRoute` to the top-level children list in `rootRoute.addChildren([...])`:

```typescript
const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  authCallbackRoute,
  welcomeRoute,
  authedRoute.addChildren([
    // ... unchanged
  ]),
]);
```

- [ ] **Step 3: Run — sanity check the type-level registration**

```bash
pnpm -C frontend exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/auth.callback.tsx frontend/src/router.ts
git commit -m "feat(frontend): /auth/callback route for Supabase OAuth return (Phase 6b)"
```

### Task C2: Async beforeLoad in auth-sensitive routes

**Files:**
- Modify: `frontend/src/routes/_authed.tsx`
- Modify: `frontend/src/routes/sign-in.tsx`
- Modify: `frontend/src/routes/index.tsx`
- Modify: `frontend/src/routes/welcome.tsx`

For each of the four routes, the pattern is the same: replace synchronous `tokenStore.get()` with `await getSupabaseClient().auth.getSession()` inside an `async beforeLoad`.

- [ ] **Step 1: `frontend/src/routes/_authed.tsx`**

```typescript
import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { getSupabaseClient } from "../lib/supabase";
import { meQueryOptions, myTasksQueryOptions } from "../queries/me";

export const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: async ({ context, location }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) {
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
    await context.queryClient.ensureQueryData(myTasksQueryOptions());
  },
  component: Outlet,
});
```

- [ ] **Step 2: `frontend/src/routes/sign-in.tsx`**

```typescript
import { createRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import GoogleAuthScreen from "../screens/GoogleAuthScreen";
import { useAuth } from "../auth/session";
import { getSupabaseClient } from "../lib/supabase";
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
      onSignIn={async () => {
        await signIn();
        // Browser redirects to Google; nothing more to do here.
        // If the redirect ever becomes a no-op (e.g., provider unconfigured),
        // the user remains on /sign-in — acceptable failure mode.
      }}
    />
  );
  // `search.returnTo` flows through to the callback route via `signIn`'s
  // `redirectTo` — see auth/session.tsx.
  void search;
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (raw: Record<string, unknown>): SignInSearch => ({
    returnTo: typeof raw.returnTo === "string" ? raw.returnTo : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) return;
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: SignInRoute,
});
```

**Note on `returnTo`:** Supabase's OAuth `redirectTo` is set once in `signIn` as `${origin}/auth/callback`. The callback route reads `?returnTo=...` from its own query string. If the app wants `/sign-in?returnTo=/foo` to survive the round-trip, `signIn` must pass the inner returnTo through the redirect URL — extend `signIn()` to accept an optional `returnTo` and append it: `redirectTo: ${origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`. Update `routes/sign-in.tsx`'s `onSignIn` to pass `search.returnTo`:

```typescript
onSignIn={async () => {
  await signIn(search.returnTo);
}}
```

And update `signIn` in `auth/session.tsx` accordingly:

```typescript
const signIn = useCallback(async (returnTo?: string) => {
  const supabase = getSupabaseClient();
  const callback = new URL(`${window.location.origin}/auth/callback`);
  if (returnTo) callback.searchParams.set("returnTo", returnTo);
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString() },
  });
}, []);
```

Update `AuthCtx` interface so `signIn: (returnTo?: string) => Promise<void>`.

Update `frontend/src/auth/__tests__/session.test.tsx` signIn test to pass no args + one variant test that calls `signIn("/tasks/T1")` and asserts the redirectTo URL includes `?returnTo=%2Ftasks%2FT1`.

- [ ] **Step 3: `frontend/src/routes/index.tsx`**

Read the current file first:

```bash
cat frontend/src/routes/index.tsx
```

Then rewrite replacing any `tokenStore.get()` with Supabase session read. Full replacement (adjust to match your actual file; the typical shape is):

```typescript
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { getSupabaseClient } from "../lib/supabase";
import { meQueryOptions } from "../queries/me";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) throw redirect({ to: "/sign-in" });
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: () => null,
});
```

- [ ] **Step 4: `frontend/src/routes/welcome.tsx`**

Same pattern — swap `tokenStore.get()` for Supabase session read in `beforeLoad`:

```typescript
beforeLoad: async () => {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw redirect({ to: "/sign-in" });
},
```

(Keep the rest of the file untouched — the ProfileSetupForm component logic is owned by plan 4c.)

- [ ] **Step 5: Run typecheck + full test**

```bash
pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test
```

Expected: clean typecheck. Tests may fail on routing-level guards that depended on `tokenStore.set("...")`; fix those in Task C3.

### Task C3: Update `renderRoute` test helper to seed Supabase sessions

**Files:**
- Modify: `frontend/src/test/renderRoute.tsx`

- [ ] **Step 1: Read current `renderRoute.tsx`**

```bash
cat frontend/src/test/renderRoute.tsx
```

- [ ] **Step 2: Add fake Supabase wiring**

Accept an optional `session` parameter; install a fake client for the test's lifetime; seed the session.

Insert at the top of the `renderRoute` function (pseudo-edit; match the actual exported signature):

```typescript
import { makeFakeSupabase, makeSession } from "./supabase-mock";
import { setSupabaseClientForTesting } from "../lib/supabase";

// ...

export function renderRoute(opts: {
  initialPath: string;
  session?: "signed-in" | "signed-out";
  // ...other existing opts
}) {
  const fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
  if (opts.session === "signed-in") fake.setSession(makeSession());

  // ... existing render logic ...

  // Return cleanup that also resets the client.
  const existingCleanup = /* whatever the function already returns */;
  return {
    ...existingCleanup,
    cleanup: () => {
      setSupabaseClientForTesting(null);
      existingCleanup.cleanup?.();
    },
  };
}
```

Call-site sweep: any existing test that did `tokenStore.set("x"); renderRoute(...)` becomes `renderRoute({ ..., session: "signed-in" })`.

- [ ] **Step 3: Grep for call sites**

```bash
grep -rn 'tokenStore' frontend/src
```

Expected: zero matches AFTER this task lands. Every hit is a rewrite target.

- [ ] **Step 4: Run full suite**

```bash
pnpm -C frontend test
```

Expected: green. Expect to touch a handful of test files that were reading `tokenStore` directly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/ frontend/src/test/renderRoute.tsx frontend/src/auth/session.tsx frontend/src/auth/__tests__/session.test.tsx
git commit -m "refactor(frontend): route guards read Supabase session (Phase 6b)"
```

---

## Section D — GoogleAuthScreen + MSW cleanup

**Exit criteria:** Sign-in screen is a single Google-branded button; MSW handlers no longer serve `/auth/google` + `/auth/logout` routes.

### Task D1: Collapse `GoogleAuthScreen`

**Files:**
- Modify: `frontend/src/screens/GoogleAuthScreen.tsx`
- Delete: `frontend/src/dev/demo-accounts.json`
- Delete: `backend/src/backend/scripts/dump_demo_accounts.py`
- Modify: `justfile` — remove `gen-demo-accounts` recipe

- [ ] **Step 1: Simplify the component signature + body**

```typescript
import { fs } from "../utils";
import { useState } from "react";
import GoogleLogo from "../ui/GoogleLogo";
import GoogleSpinner from "../ui/GoogleSpinner";

export interface GoogleAuthScreenProps {
  onCancel: () => void;
  onSignIn: () => Promise<void>;
}

export default function GoogleAuthScreen({ onCancel, onSignIn }: GoogleAuthScreenProps) {
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const click = async () => {
    setPending(true);
    setError(null);
    try {
      await onSignIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
      setPending(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        color: "var(--fg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <GoogleLogo />
        {!pending && (
          <button
            type="button"
            aria-label="關閉"
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              padding: 8,
              margin: -8,
              cursor: "pointer",
              color: "#5F6368",
              fontSize: fs(20),
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 28px",
          gap: 24,
        }}
      >
        <h1
          style={{
            fontFamily: '"Google Sans", "Noto Sans TC", sans-serif',
            fontSize: fs(22),
            fontWeight: 500,
            color: "#202124",
            margin: 0,
            textAlign: "center",
          }}
        >
          使用 Google 帳號登入
        </h1>
        <p
          style={{
            fontSize: fs(13),
            color: "#5F6368",
            margin: 0,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          繼續前往 <span style={{ color: "#1A73E8" }}>金富有志工</span>。
          Google 會將您的姓名、電子郵件地址、語言偏好與大頭貼分享給本應用程式。
        </p>

        {pending ? (
          <GoogleSpinner />
        ) : (
          <button
            type="button"
            onClick={click}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 24px",
              border: "1px solid #DADCE0",
              borderRadius: 24,
              background: "#fff",
              color: "#3C4043",
              font: "inherit",
              fontWeight: 500,
              fontSize: fs(14),
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8F9FA")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            <GoogleLogo size={18} />
            <span>繼續使用 Google 登入</span>
          </button>
        )}

        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #F2B8B5",
              background: "#FCE8E6",
              color: "#C5221F",
              fontSize: fs(13),
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

If `GoogleLogo` doesn't accept a `size` prop, the inline logo size prop is fine; fall back to the default size — adjust to match the current `GoogleLogo` component API.

- [ ] **Step 2: Delete demo-picker plumbing**

```bash
rm frontend/src/dev/demo-accounts.json
rmdir frontend/src/dev 2>/dev/null || true
rm backend/src/backend/scripts/dump_demo_accounts.py
```

- [ ] **Step 3: Drop the `gen-demo-accounts` recipe from `justfile`**

Open the repo-root `justfile`. Delete these two lines:

```
# Generate frontend demo-account picker JSON from backend.seed.DEMO_USERS (writes frontend/src/dev/demo-accounts.json, checked in).
gen-demo-accounts:
    uv run --project backend python -m backend.scripts.dump_demo_accounts > frontend/src/dev/demo-accounts.json
```

- [ ] **Step 4: Run lint + typecheck + test**

```bash
pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test
```

Expected: green. If anything imports `demo-accounts.json` anywhere, fix the import (should only have been `GoogleAuthScreen.tsx` and tests that referenced the picker).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/GoogleAuthScreen.tsx justfile
git add -u frontend/src/dev backend/src/backend/scripts
git commit -m "refactor(frontend): one-button GoogleAuthScreen; drop demo picker (Phase 6b)"
```

### Task D2: Retarget MSW handlers

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`

- [ ] **Step 1: Delete the `/auth/google` + `/auth/logout` handlers**

Full rewrite of `frontend/src/test/msw/handlers.ts`:

```typescript
import { http, HttpResponse } from "msw";
import * as f from "./fixtures";

export const defaultHandlers = [
  http.get("/api/v1/me", () => HttpResponse.json(f.userJet)),
  http.get("/api/v1/me/tasks", () => HttpResponse.json(f.tasksList)),
  http.get("/api/v1/me/teams", () => HttpResponse.json(f.myTeams)),
  http.get("/api/v1/me/rewards", () => HttpResponse.json(f.rewardsList)),
  http.get("/api/v1/tasks/:id", ({ params }) => {
    const t = f.tasksList.find((x) => x.id === params.id);
    return t
      ? HttpResponse.json(t)
      : HttpResponse.json({ detail: "Task not found" }, { status: 404 });
  }),
  http.get("/api/v1/news", () => HttpResponse.json({ items: f.newsList, next_cursor: null })),
  http.get("/api/v1/leaderboard/users", () => HttpResponse.json({ items: [], next_cursor: null })),
  http.get("/api/v1/leaderboard/teams", () => HttpResponse.json({ items: [], next_cursor: null })),
  http.get("/api/v1/teams", () => HttpResponse.json({ items: [], next_cursor: null })),
];
```

No Supabase-direct handlers needed — tests never let `apiFetch` hit Supabase's REST API (the fake client short-circuits `getSession`). If a future test explicitly exercises Supabase's network calls, add handlers then.

- [ ] **Step 2: Run full suite**

```bash
pnpm -C frontend test
```

Expected: green.

- [ ] **Step 3: Verify no `/auth/google` or `/auth/logout` references remain**

```bash
grep -rn 'auth/google\|auth/logout\|postGoogleAuth\|postLogout' frontend/src
```

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/test/msw/handlers.ts
git commit -m "test(frontend): drop stub auth handlers from MSW defaults (Phase 6b)"
```

---

## Section E — CSP + vercel.json

**Exit criteria:** `frontend/vercel.json` ships the CSP from spec §5.5; `pnpm -C frontend build` produces a dist/ that a static HTML parser can verify has no inline `<script>` elements the CSP would reject.

### Task E1: Write `vercel.json`

**Files:**
- Create: `frontend/vercel.json`

- [ ] **Step 1: Create `frontend/vercel.json`**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io; img-src 'self' data: https://*.googleusercontent.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/((?!assets/|auth/callback).*)", "destination": "/index.html" }
  ]
}
```

Note the rewrite regex: it excludes `assets/` (Vite's hashed-asset folder) and `auth/callback` (our new route, which is served by the SPA index just fine, but the exclusion is defensive — some Vercel builds have treated callback-style routes specially; easier to be explicit).

- [ ] **Step 2: Build the frontend and sanity-check inline scripts**

```bash
pnpm -C frontend build
grep -n '<script' frontend/dist/index.html
```

Expected: every `<script>` tag has a `src=` attribute (Vite emits hashed chunks; no inline module). If any inline `<script>` shows up, you have an ingestion issue with index.html that needs addressing before CSP will pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat(frontend): CSP + security headers in vercel.json (Phase 6b)"
```

---

## Section F — Manual smoke against a real Supabase project (optional, pre-merge)

Not required for merge — 6b is a code-only PR — but strongly recommended before moving to 7a.

- [ ] **Step 1: Set up a dev Supabase project** (separate from any prod project; same prereqs as §0 of plan 6a).

- [ ] **Step 2: Fill in `frontend/.env.local` with the dev project's `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`**.

- [ ] **Step 3: Run backend + frontend locally**

```bash
# Terminal 1
just -f backend/justfile db-up
just -f backend/justfile migrate
# Set SUPABASE_URL in backend/.env to the dev project URL
just -f backend/justfile dev

# Terminal 2
pnpm -C frontend dev
```

- [ ] **Step 4: In a browser, open http://localhost:5173**

Click "Sign in with Google" → Google consent → browser returns to http://localhost:5173/auth/callback → navigates to /welcome (profile incomplete) or /home (profile complete). Complete the profile. Exercise task submission. Sign out → redirected to /sign-in.

If anything breaks, fix and commit under this section; otherwise merge.

---

## Final self-check before handoff to 7a

- [ ] `pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test` all green.
- [ ] `grep -rn "tokenStore\|ga.token\|postGoogleAuth\|postLogout" frontend/src` returns nothing.
- [ ] `frontend/src/auth/` contains `session.tsx` (+ its test) only.
- [ ] `frontend/vercel.json` exists with the CSP + rewrite shape above.
- [ ] `frontend/src/routes/auth.callback.tsx` is registered in `router.ts`.
- [ ] `frontend/.env.example` has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- [ ] `frontend/src/dev/` no longer exists; `backend/src/backend/scripts/dump_demo_accounts.py` no longer exists; `justfile`'s `gen-demo-accounts` recipe no longer exists.

Once this plan is merged, the app runs end-to-end locally (backend verifies real Supabase JWTs; frontend authenticates through Supabase). The next plan (7a) focuses entirely on getting it onto the public internet at `jinfuyou.app`.
