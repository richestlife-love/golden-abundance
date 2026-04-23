# Phase 6b — Frontend Auth Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bespoke email-stub + `tokenStore` frontend auth path with `@supabase/supabase-js`. Sign-in becomes a single "Continue with Google" button that triggers Supabase's OAuth flow (PKCE). Session lives in Supabase's managed localStorage entries (not `ga.token`). The existing 401-interceptor, `returnTo` flow, and optimistic-mutation invalidation map all survive unchanged — only the token source of truth moves.

**Prereqs:** Plan 6a merged. A working Supabase project dev URL + anon key available for local dev (can be the same Supabase project used in deployed envs — the anon key is public by design).

**Architecture:** `src/lib/supabase.ts` owns a singleton Supabase client with a test-overridable setter (mirrors the `setRouterRef` + `_setActiveQueryClient` patterns in the codebase). `apiFetch` reads the access token via `supabase.auth.getSession()` instead of a synchronous localStorage read. `AuthProvider` subscribes to Supabase's `onAuthStateChange` so React sees sign-in/out reactively. A new `/auth/callback` route explicitly exchanges the OAuth `?code=...` for a session via `supabase.auth.exchangeCodeForSession(window.location.search)`, then navigates to `returnTo`. `vercel.json` ships the CSP that locks network access to Supabase + Sentry + self.

**Tech Stack:** Vite 8, React 19, TanStack Router 1.168, TanStack Query 5.99, MSW 2.13, vitest 4.1, TypeScript 6, pnpm 10.33; new dep `@supabase/supabase-js` ^2.46.

**Spec:** `docs/superpowers/specs/2026-04-21-phase-6-7-auth-deploy-design.md` §5 (Sub-plan 6b).

**Exit criteria:**
- `pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test` all green.
- `grep -rn "tokenStore\|ga.token\|postGoogleAuth\|postLogout" frontend/src` returns no matches.
- No file imports `./dev/demo-accounts.json` or `./dev/demo-accounts` (both files deleted).
- `vercel.json` present at `frontend/vercel.json` with the CSP headers from §5.5 of the design spec.
- Running `pnpm -C frontend build` emits a clean dist/; inspecting `frontend/dist/index.html` shows only bundled script sources (no inline `<script>` the CSP would reject).

---

## Scoping decisions locked before drafting

| Decision | Choice | Why |
|---|---|---|
| Supabase SDK version | `@supabase/supabase-js@^2.46` | Current stable; supports `signInWithOAuth` + `onAuthStateChange` + `exchangeCodeForSession` API used here. |
| Client singleton pattern | Overridable holder (`getSupabaseClient()` + `setSupabaseClientForTesting()`) | Matches existing `setRouterRef` DI pattern; avoids `vi.mock()` fragility. |
| Session storage | Supabase SDK default (localStorage under `sb-<ref>-auth-token`) | Per §6 of design spec; avoids custom storage adapter. |
| Auto-refresh | On (SDK default) | Sessions refresh ~5 min before expiry without extra code. |
| OAuth redirect URL | `${window.location.origin}/auth/callback` (with optional `?returnTo=...` appended) | Matches Supabase Authentication → URL Configuration's additional-redirect list (set in 6a §0). Supabase's allowlist match is prefix-based, so query params pass through. |
| OAuth flow type | **PKCE** (`flowType: "pkce"`, SDK default) | OAuth 2.1 current best practice; more secure than implicit. Requires explicit `exchangeCodeForSession` in the callback route. |
| `detectSessionInUrl` | `false` | Callback route explicitly exchanges code → session. Makes failures observable, avoids racing with SDK auto-detection during client construction. |
| `onAuthStateChange` handling | Subscribe in `AuthProvider`, dispatch to local `setSignedIn` | One React subscription per app lifetime. |
| Sign-out | `await supabase.auth.signOut()` *then* the existing cache-clear + router-navigate sequence | Local signout is purely client-side; SDK clears its own storage. |
| Demo-picker | Deleted outright, no dev-only fallback | Per §5.7 of design spec; local dev uses real Google against a dev Supabase project. |
| CSP location | `frontend/vercel.json` in this plan | Spec §5.5 puts it in 6b; 7a reuses the file. |
| Test env vars | `vi.stubEnv` in the one test that exercises the real factory | Avoids committing a `.env.test` or complicating `.gitignore`. |

---

## File plan

Files created (C), modified (M), or deleted (D). Paths relative to repo root `/Users/Jet/Developer/golden-abundance`.

### Frontend source

| Path | Action | Contents |
|---|---|---|
| `frontend/package.json` | M | Add `@supabase/supabase-js` (runtime dep) |
| `frontend/src/lib/supabase.ts` | C | Client singleton + test-friendly setter |
| `frontend/src/auth/session.tsx` | M | Rewrite `signIn` + `signOut` + `AuthProvider` |
| `frontend/src/auth/token.ts` | D | Gone — session lives in the Supabase client |
| `frontend/src/api/client.ts` | M | Async token lookup via Supabase session |
| `frontend/src/api/auth.ts` | D | `/auth/google` + `/auth/logout` endpoints gone |
| `frontend/src/routes/auth.callback.tsx` | C | Post-OAuth redirect handler (calls `exchangeCodeForSession`) |
| `frontend/src/routes/sign-in.tsx` | M | Async `beforeLoad`, single-button handler, accepts optional `returnTo` |
| `frontend/src/routes/_authed.tsx` | M | Async `beforeLoad` reads Supabase session |
| `frontend/src/routes/index.tsx` | M | Async auth check for initial route |
| `frontend/src/routes/welcome.tsx` | M | Async `beforeLoad` reads Supabase session |
| `frontend/src/router.ts` | M | Register `authCallbackRoute` in the route tree |
| `frontend/src/screens/GoogleAuthScreen.tsx` | M | Collapse to a single "Sign in with Google" button |
| `frontend/src/dev/demo-accounts.ts` | D | Wrapper module — gone |
| `frontend/src/dev/demo-accounts.json` | D | Data — gone |
| `backend/src/backend/scripts/dump_demo_accounts.py` | D | Generator is gone |
| `justfile` | M | Delete `gen-demo-accounts` recipe |
| `frontend/.env.example` | M | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `frontend/vercel.json` | C | CSP + security headers + SPA rewrite |

### Frontend tests

| Path | Action | Contents |
|---|---|---|
| `frontend/src/test/setup.ts` | M | Clear Supabase test override in `afterEach` |
| `frontend/src/test/supabase-mock.ts` | C | Controllable fake Supabase client for tests |
| `frontend/src/test/msw/handlers.ts` | M | Drop `/auth/google`, `/auth/logout` handlers |
| `frontend/src/test/msw/fixtures.ts` | M | Drop orphaned `authResponseJet` |
| `frontend/src/test/renderRoute.tsx` | M | Replace `token` opt with `session: "signed-in" \| "signed-out"` |
| `frontend/src/lib/__tests__/supabase.test.ts` | C | Singleton + override tests |
| `frontend/src/auth/__tests__/session.test.tsx` | M | Rewrite against fake Supabase client |
| `frontend/src/auth/__tests__/token.test.ts` | D | Module deleted |
| `frontend/src/api/__tests__/client.test.ts` | M | 401 + token attachment tests use fake session; other assertions preserved |
| `frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx` | M | Rewrite for one-button flow |
| `frontend/src/screens/__tests__/session-expiry.test.tsx` | M | Seed session via `{ session: "signed-in" }` |
| `frontend/src/routes/__tests__/routing.test.tsx` | M | Migrate all `{ token: TOKEN }` → `{ session: "signed-in" }` |

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
- Create: `frontend/src/lib/__tests__/supabase.test.ts`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Write the failing test `frontend/src/lib/__tests__/supabase.test.ts`**

```typescript
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  getSupabaseClient,
  setSupabaseClientForTesting,
} from "../supabase";

beforeAll(() => {
  // getSupabaseClient()'s real factory reads these on first call. Stub
  // at file scope so every test in this file sees them. No .env.test
  // file needed — other tests install a fake via setSupabaseClientForTesting
  // and never trigger the real factory.
  vi.stubEnv("VITE_SUPABASE_URL", "https://test-ref.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key-not-a-real-jwt");
});

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
      // PKCE (default in @supabase/supabase-js v2). The callback route
      // explicitly calls `exchangeCodeForSession(window.location.search)`
      // to turn the `?code=...` into a session, so we disable
      // auto-detection — failures become observable instead of silent.
      detectSessionInUrl: false,
      flowType: "pkce",
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

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/supabase.ts frontend/src/lib/__tests__/supabase.test.ts frontend/.env.example
git commit -m "feat(frontend): Supabase client singleton with test override (Phase 6b)"
```

### Task A3: Fake Supabase client for tests

**Files:**
- Create: `frontend/src/test/supabase-mock.ts`

- [ ] **Step 1: Create `frontend/src/test/supabase-mock.ts`**

```typescript
import type { AuthError, Session, SupabaseClient, User } from "@supabase/supabase-js";

/** Minimal fake matching the surface src/ uses. Add fields on demand; don't speculate. */
export interface FakeSupabaseHandle {
  client: SupabaseClient;
  setSession: (session: Session | null) => void;
  signInCalls: Array<{ provider: string; redirectTo?: string }>;
  signOutCalls: number;
  exchangeCalls: string[];
  /** Pre-set to an Error-like object to make the next exchangeCodeForSession call fail. */
  nextExchangeError: AuthError | null;
}

export function makeFakeSupabase(): FakeSupabaseHandle {
  let session: Session | null = null;
  const listeners = new Set<(event: string, s: Session | null) => void>();
  const handle: FakeSupabaseHandle = {
    client: null as unknown as SupabaseClient,
    signInCalls: [],
    signOutCalls: 0,
    exchangeCalls: [],
    nextExchangeError: null,
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
      exchangeCodeForSession: (query: string) => {
        handle.exchangeCalls.push(query);
        if (handle.nextExchangeError) {
          const error = handle.nextExchangeError;
          handle.nextExchangeError = null;
          return Promise.resolve({ data: { session: null, user: null }, error });
        }
        const s = makeSession();
        session = s;
        for (const l of listeners) l("SIGNED_IN", s);
        return Promise.resolve({ data: { session: s, user: s.user }, error: null });
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

### Task A4: Centralized Supabase cleanup in test setup

**Files:**
- Modify: `frontend/src/test/setup.ts`

- [ ] **Step 1: Edit `frontend/src/test/setup.ts`**

Add the Supabase override cleanup to the existing `afterEach`. Full `afterEach` block after the edit:

```typescript
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
  setSupabaseClientForTesting(null);
});
```

Add the import at the top:

```typescript
import { setSupabaseClientForTesting } from "../lib/supabase";
```

This catches stray overrides from any test that forgets to reset — the per-file `setSupabaseClientForTesting(null)` in individual test files becomes belt-and-suspenders rather than load-bearing.

- [ ] **Step 2: Run — existing tests still green**

```bash
pnpm -C frontend test
```

Expected: green (setup-only change, no-op when nothing installs an override).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/test/setup.ts
git commit -m "test(frontend): clear Supabase test override in afterEach (Phase 6b)"
```

---

## Section B — Rewire AuthProvider + apiFetch

**Exit criteria:** `AuthProvider` reflects Supabase session state; `apiFetch` pulls the access token from the Supabase session on each call; existing 401 interceptor flow unchanged; `token.ts` and `api/auth.ts` deleted.

> **Sequencing note:** `session.tsx` no longer imports `tokenStore` after Task B2, but `client.ts` still does until Task B3. We defer the deletion of `auth/token.ts` + `api/auth.ts` to Task B3 (after `client.ts` is rewritten) so the project never passes through a state with broken imports. TDD discipline is preserved — each task writes a failing test first.

### Task B1: Rewrite AuthProvider session test first

**Files:**
- Modify: `frontend/src/auth/__tests__/session.test.tsx`

- [ ] **Step 1: Replace the file with the new test shape**

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

function probe(qc: QueryClient, onSignIn?: (returnTo?: string) => void) {
  function Probe() {
    const { isSignedIn, signIn, signOut } = useAuth();
    return (
      <div>
        <div data-testid="signed">{String(isSignedIn)}</div>
        <button onClick={() => void signIn(onSignIn ? "/tasks/T1" : undefined)}>in</button>
        <button onClick={() => void signOut()}>out</button>
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

  it("signIn(returnTo) encodes returnTo in the callback URL", async () => {
    const qc = new QueryClient();
    probe(qc, () => {});
    act(() => {
      screen.getByText("in").click();
    });
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    const url = new URL(fake.signInCalls[0].redirectTo!);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("returnTo")).toBe("/tasks/T1");
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

Expected: multiple failures — `signIn("jet@demo.ga")`-style legacy signature, `tokenStore` still wired, etc.

### Task B2: Rewrite `session.tsx`

**Files:**
- Modify: `frontend/src/auth/session.tsx`

> Deferred to Task B3 (not done here): deleting `auth/token.ts` + `auth/__tests__/token.test.ts` + `api/auth.ts`. They are still imported by `api/client.ts` at this point; deleting them now would break the build between commits.

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
  signIn: (returnTo?: string) => Promise<void>;
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
  // Initial state is async — `signedIn` is false for one render cycle even
  // when Supabase has a persisted session. Routes don't depend on this
  // (they call getSession() directly in beforeLoad), so the brief mismatch
  // is invisible to users.
  const [signedIn, setSignedIn] = useState<boolean>(false);

  useEffect(() => {
    _setActiveQueryClient(qc);
    return () => _setActiveQueryClient(null);
  }, [qc]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSignedIn(!!data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (returnTo?: string) => {
    const supabase = getSupabaseClient();
    const callback = new URL(`${window.location.origin}/auth/callback`);
    if (returnTo) callback.searchParams.set("returnTo", returnTo);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
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

- [ ] **Step 2: Run — session tests pass**

```bash
pnpm -C frontend test src/auth/__tests__/session.test.tsx
```

Expected: 6 tests pass. `token.ts` still exists and is still imported by `client.ts`, so the broader build is still intact.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/auth/session.tsx frontend/src/auth/__tests__/session.test.tsx
git commit -m "refactor(frontend): AuthProvider uses Supabase client (Phase 6b)"
```

### Task B3: Async token lookup in `apiFetch` + final deletions

**Files:**
- Modify: `frontend/src/api/__tests__/client.test.ts`
- Modify: `frontend/src/api/client.ts`
- Delete: `frontend/src/auth/token.ts`
- Delete: `frontend/src/auth/__tests__/token.test.ts`
- Delete: `frontend/src/api/auth.ts`

- [ ] **Step 1: Rewrite `frontend/src/api/__tests__/client.test.ts`**

Preserve every test that wasn't auth-coupled; swap the two token-related tests to seed sessions via the fake.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { apiFetch, setSessionExpiredHandler } from "../client";
import { ApiError } from "../errors";
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
  setSessionExpiredHandler(null);
});

describe("apiFetch", () => {
  it("sends Authorization: Bearer when session is active", async () => {
    let seenAuth: string | null = null;
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    fake.setSession(makeSession("token-abc"));
    await apiFetch("/me");
    expect(seenAuth).toBe("Bearer token-abc");
  });

  it("omits Authorization when no session", async () => {
    let seenAuth: string | null = "<unset>";
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/me");
    expect(seenAuth).toBeNull();
  });

  it("returns parsed JSON on 200", async () => {
    server.use(http.get("/api/v1/me", () => HttpResponse.json({ x: 1 })));
    const data = await apiFetch<{ x: number }>("/me");
    expect(data).toEqual({ x: 1 });
  });

  it("returns undefined on 204", async () => {
    server.use(http.post("/api/v1/ping", () => new HttpResponse(null, { status: 204 })));
    const data = await apiFetch<void>("/ping", { method: "POST" });
    expect(data).toBeUndefined();
  });

  it("throws ApiError with detail on non-2xx", async () => {
    server.use(
      http.get("/api/v1/teams/x", () =>
        HttpResponse.json({ detail: "team not found" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/teams/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      detail: "team not found",
    });
  });

  it("falls back to statusText when body lacks detail", async () => {
    server.use(
      http.get("/api/v1/me", () =>
        HttpResponse.text("not json", { status: 500, statusText: "Server Error" }),
      ),
    );
    await expect(apiFetch("/me")).rejects.toMatchObject({
      status: 500,
      detail: "Server Error",
    });
  });

  it("calls registered session-expired handler on 401", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    fake.setSession(makeSession());
    server.use(http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })));
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ returnTo: expect.any(String) });
  });

  it("does not throw when no 401 handler is registered", async () => {
    server.use(http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })));
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (apiFetch still reads `tokenStore`)**

```bash
pnpm -C frontend test src/api/__tests__/client.test.ts
```

Expected: FAIL — "sends Authorization" test sees null auth because `tokenStore.get()` returns nothing; fake session isn't consulted.

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
  // Async localStorage read via the SDK. Sub-millisecond in practice —
  // the SDK caches the session in memory and only touches storage on
  // startup or cross-tab sync.
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

- [ ] **Step 4: Run — client tests pass**

```bash
pnpm -C frontend test src/api/__tests__/client.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Delete the now-orphaned modules**

```bash
rm frontend/src/auth/token.ts
rm frontend/src/auth/__tests__/token.test.ts
rm frontend/src/api/auth.ts
```

- [ ] **Step 6: Run — full suite green so far (routes still use `tokenStore` in source, though — expect failures there)**

```bash
pnpm -C frontend exec tsc --noEmit
```

Expected: FAIL — `routes/_authed.tsx`, `routes/sign-in.tsx`, `routes/index.tsx`, `routes/welcome.tsx`, `test/renderRoute.tsx`, and a few test files still import from `../auth/token`. Those are fixed in Section C.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/ frontend/src/auth/
git commit -m "refactor(frontend): apiFetch reads token from Supabase session (Phase 6b)"
```

---

## Section C — Route guards + OAuth callback

**Exit criteria:** `/auth/callback` receives the post-OAuth redirect and exchanges the code for a session before navigating on; `_authed.tsx`, `index.tsx`, `sign-in.tsx`, `welcome.tsx` switch to async `beforeLoad`s that read Supabase session state; every `tokenStore` reference is gone from `frontend/src`.

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
    const supabase = getSupabaseClient();
    let cancelled = false;
    void (async () => {
      // PKCE: Supabase redirected here with `?code=<pkce-code>`.
      // Exchange it for a session (and trigger onAuthStateChange).
      // Pass window.location.search so the SDK parses the code + state.
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.search,
      );
      if (cancelled) return;
      navigate({ to: error ? "/sign-in" : (search.returnTo ?? "/") });
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

- [ ] **Step 3: Commit**

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

Full replacement:

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

Full replacement:

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
        // `signIn` triggers a top-level browser redirect. Control does
        // not resume here after success; if the redirect is a no-op
        // (e.g. provider unconfigured), the user stays on /sign-in.
        await signIn(search.returnTo);
      }}
    />
  );
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

- [ ] **Step 3: `frontend/src/routes/index.tsx`**

Full replacement (preserves the LandingScreen-for-guests behavior):

```typescript
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import LandingScreen from "../screens/LandingScreen";
import { getSupabaseClient } from "../lib/supabase";
import { meQueryOptions } from "../queries/me";
import { rootRoute } from "./__root";

function LandingRoute() {
  const navigate = useNavigate();
  // Guest branch: guard passes through; CTA sends user to sign-in.
  return <LandingScreen onStart={() => navigate({ to: "/sign-in" })} />;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) return;
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: LandingRoute,
});
```

- [ ] **Step 4: `frontend/src/routes/welcome.tsx`**

Swap the token import + `beforeLoad` guard only; leave the component body + `useSuspenseQuery` + mutation logic untouched.

Replace the top-of-file import block:

```typescript
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useCompleteProfile } from "../mutations/me";
import { useAuth } from "../auth/session";
import { getSupabaseClient } from "../lib/supabase";
import { meQueryOptions } from "../queries/me";
import { rootRoute } from "./__root";
```

Replace the `beforeLoad` block:

```typescript
beforeLoad: async ({ context, location }) => {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) {
    throw redirect({
      to: "/sign-in",
      search: { returnTo: location.href },
    });
  }
  const me = await context.queryClient.ensureQueryData(meQueryOptions());
  if (me.profile_complete) throw redirect({ to: "/home" });
},
```

- [ ] **Step 5: Run typecheck — expect source-level typecheck clean; tests may still fail**

```bash
pnpm -C frontend exec tsc --noEmit
```

Expected: src/ typechecks. Tests still fail because `renderRoute.tsx` + test files import `tokenStore`. Fixed in Task C3.

### Task C3: Update `renderRoute` test helper

**Files:**
- Modify: `frontend/src/test/renderRoute.tsx`

- [ ] **Step 1: Full rewrite — swap `token` for `session`, preserve positional `path`**

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/session";
import { UIStateProvider } from "../ui/UIStateProvider";
import { createAppRouter, setRouterRef } from "../router";
import { makeTestQueryClient } from "./queryClient";
import { makeFakeSupabase, makeSession } from "./supabase-mock";
import { setSupabaseClientForTesting } from "../lib/supabase";

export interface RenderRouteOpts {
  /** Seed a Supabase session before mounting. Defaults to "signed-out". */
  session?: "signed-in" | "signed-out";
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
}

export function renderRoute(path: string, opts: RenderRouteOpts = {}): RenderRouteResult {
  const fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
  if (opts.session === "signed-in") fake.setSession(makeSession());

  const queryClient = makeTestQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  setRouterRef(router);
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/routes/ frontend/src/test/renderRoute.tsx
git commit -m "refactor(frontend): route guards read Supabase session (Phase 6b)"
```

### Task C4: Migrate existing test callers off `{ token: TOKEN }`

**Files:**
- Modify: `frontend/src/routes/__tests__/routing.test.tsx`
- Modify: `frontend/src/screens/__tests__/session-expiry.test.tsx`

- [ ] **Step 1: Migrate `routing.test.tsx`**

Mechanical sweep across ~20 call sites. For each:

| Before | After |
|---|---|
| `renderRoute("/home", { token: TOKEN })` | `renderRoute("/home", { session: "signed-in" })` |
| `renderRoute("/path")` (no opts) | unchanged |

Also delete the top-of-file `const TOKEN = "test-token-jet";` (now unused) and any `import { tokenStore }` line. Run the grep to find every call site:

```bash
grep -n "renderRoute(" frontend/src/routes/__tests__/routing.test.tsx
grep -n "TOKEN\|tokenStore" frontend/src/routes/__tests__/routing.test.tsx
```

Touch each.

- [ ] **Step 2: Migrate `session-expiry.test.tsx`**

This test exercises the 401-interceptor → signOut flow. The exact token string doesn't matter — the MSW handler returns 401 regardless. Swap:

```typescript
const { router } = renderRoute("/me", { token: "expired-token" });
```

with:

```typescript
const { router } = renderRoute("/me", { session: "signed-in" });
```

Delete the `import { tokenStore }` line if present.

- [ ] **Step 3: Run — grep should return zero**

```bash
grep -rn "tokenStore" frontend/src && echo "FAIL — still references" || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Run the full suite**

```bash
pnpm -C frontend test
```

Expected: green except for `GoogleAuthScreen.test.tsx` (still asserts the demo-chip UI that disappears in Section D) — fix that in Task D1.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/__tests__/routing.test.tsx frontend/src/screens/__tests__/session-expiry.test.tsx
git commit -m "test(frontend): renderRoute call sites use session seed (Phase 6b)"
```

---

## Section D — GoogleAuthScreen + MSW cleanup

**Exit criteria:** Sign-in screen is a single Google-branded button; `/auth/google` + `/auth/logout` handlers and fixtures are gone from MSW; demo-picker JSON + TS wrapper + generator script all deleted.

### Task D1: Collapse `GoogleAuthScreen` + rewrite its test

**Files:**
- Modify: `frontend/src/screens/GoogleAuthScreen.tsx`
- Modify: `frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx`
- Delete: `frontend/src/dev/demo-accounts.ts`
- Delete: `frontend/src/dev/demo-accounts.json`
- Delete: `backend/src/backend/scripts/dump_demo_accounts.py`
- Modify: `justfile` — remove `gen-demo-accounts` recipe

- [ ] **Step 1: Rewrite `frontend/src/screens/GoogleAuthScreen.tsx`**

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
      // onSignIn triggers a top-level redirect; if we land here without
      // a redirect, leave `pending` true so the user sees the spinner
      // rather than a re-armed button. A back-navigation resets state.
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
            <GoogleLogo />
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

(Current `GoogleLogo` component takes no `size` prop — use the default.)

- [ ] **Step 2: Rewrite `frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx`**

The old test clicked a demo-account button; the new test asserts the single button triggers `signInWithOAuth`.

```typescript
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "../../test/renderRoute";

describe("GoogleAuthScreen via /sign-in", () => {
  it("clicking the Google button initiates OAuth redirect", async () => {
    renderRoute("/sign-in");
    const btn = await screen.findByRole("button", { name: /繼續使用 Google 登入/ });
    fireEvent.click(btn);
    // The fake Supabase client records signInWithOAuth calls — since the
    // component doesn't expose them directly, we assert the UI flips into
    // the pending state (spinner visible, button gone). That plus the
    // session-test coverage of signInCalls is sufficient.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /繼續使用 Google 登入/ })).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Delete demo-picker plumbing**

```bash
rm frontend/src/dev/demo-accounts.ts
rm frontend/src/dev/demo-accounts.json
rmdir frontend/src/dev 2>/dev/null || true
rm backend/src/backend/scripts/dump_demo_accounts.py
```

(`rmdir` is best-effort — if anything else lands in `frontend/src/dev/` later, the directory stays.)

- [ ] **Step 4: Drop the `gen-demo-accounts` recipe from `justfile`**

Delete these three lines from the repo-root `justfile`:

```
# Generate frontend demo-account picker JSON from backend.seed.DEMO_USERS (writes frontend/src/dev/demo-accounts.json, checked in).
gen-demo-accounts:
    uv run --project backend python -m backend.scripts.dump_demo_accounts > frontend/src/dev/demo-accounts.json
```

- [ ] **Step 5: Run lint + typecheck + test**

```bash
pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/GoogleAuthScreen.tsx frontend/src/screens/__tests__/GoogleAuthScreen.test.tsx justfile
git add -u frontend/src/dev backend/src/backend/scripts
git commit -m "refactor(frontend): one-button GoogleAuthScreen; drop demo picker (Phase 6b)"
```

### Task D2: Retarget MSW handlers + fixtures

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts`
- Modify: `frontend/src/test/msw/fixtures.ts`

- [ ] **Step 1: Rewrite `frontend/src/test/msw/handlers.ts`**

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

- [ ] **Step 2: Drop the orphaned `authResponseJet` fixture**

Open `frontend/src/test/msw/fixtures.ts`. Delete the `authResponseJet` export (and any supporting constants that were only used by it — usually a matching `accessTokenJet` or similar). Leave `userJet`, `tasksList`, `myTeams`, `newsList`, `rewardsList` untouched.

- [ ] **Step 3: Verify no leftover references**

```bash
grep -rn 'auth/google\|auth/logout\|postGoogleAuth\|postLogout\|authResponseJet' frontend/src
```

Expected: zero matches.

- [ ] **Step 4: Run full suite**

```bash
pnpm -C frontend test
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/test/msw/
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

Note the rewrite regex: it excludes `assets/` (Vite's hashed-asset folder) and `auth/callback` — `auth/callback` is served by the SPA index just fine, but the exclusion is defensive.

- [ ] **Step 2: Build the frontend and sanity-check inline scripts**

```bash
pnpm -C frontend build
grep -n '<script' frontend/dist/index.html
```

Expected: every `<script>` tag has a `src=` attribute (Vite emits hashed chunks; no inline module). If any inline `<script>` shows up, address it before CSP ships.

- [ ] **Step 3: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat(frontend): CSP + security headers in vercel.json (Phase 6b)"
```

---

## Section F — Manual smoke against a real Supabase project (optional, pre-merge)

Not required for merge — 6b is a code-only PR — but strongly recommended before moving to 7a.

> **Known smoke risk:** the OAuth redirect URL is `${origin}/auth/callback?returnTo=...`. Supabase's URL allowlist must match by prefix (i.e. the `?returnTo=...` suffix must pass through). This has historically worked but the Supabase dashboard-level behavior is worth confirming on the first real run. If the redirect 400s at Supabase's side, register both `http://localhost:5173/auth/callback` AND a wildcard/prefix pattern if needed.

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

Click "繼續使用 Google 登入" → Google consent → browser returns to http://localhost:5173/auth/callback?code=... → `exchangeCodeForSession` runs → navigates to /welcome (profile incomplete) or /home (profile complete). Complete the profile. Exercise task submission. Sign out → redirected to /sign-in.

- [ ] **Step 5: Deep-link returnTo smoke**

Open http://localhost:5173/tasks/T1 in a signed-out session. Expect redirect to /sign-in?returnTo=%2Ftasks%2FT1. Click Google button. After OAuth, expect landing on /tasks/T1 (not /).

If anything breaks, fix and commit under this section; otherwise merge.

---

## Final self-check before handoff to 7a

- [ ] `pnpm -C frontend lint && pnpm -C frontend exec tsc --noEmit && pnpm -C frontend test` all green.
- [ ] `grep -rn "tokenStore\|ga.token\|postGoogleAuth\|postLogout" frontend/src` returns nothing.
- [ ] `grep -rn 'authResponseJet\|auth/google\|auth/logout' frontend/src` returns nothing.
- [ ] `frontend/src/auth/` contains `session.tsx` (+ its test) only.
- [ ] `frontend/src/api/` no longer contains `auth.ts`.
- [ ] `frontend/vercel.json` exists with the CSP + rewrite shape above.
- [ ] `frontend/src/routes/auth.callback.tsx` is registered in `router.ts`.
- [ ] `frontend/.env.example` has `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- [ ] `frontend/src/dev/` no longer exists; `backend/src/backend/scripts/dump_demo_accounts.py` no longer exists; `justfile`'s `gen-demo-accounts` recipe no longer exists.
- [ ] `frontend/src/test/setup.ts`'s `afterEach` clears the Supabase test override.

Once this plan is merged, the app runs end-to-end locally (backend verifies real Supabase JWTs; frontend authenticates through Supabase). The next plan (7a) focuses entirely on getting it onto the public internet at `goldenabundance.app`.
