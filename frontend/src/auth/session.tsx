import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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
  /** `undefined` until the first Supabase session check resolves. Consumers
   *  that need a three-way check (signed-in / signed-out / unknown) can
   *  branch on `undefined`; `if (isSignedIn)` still works for the common
   *  "treat unknown as signed-out" case. */
  isSignedIn: boolean | undefined;
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
      // Expired sessions bounce through /sign-in so the user can re-auth
      // and land back where they were. Explicit logout goes home —
      // auto-redirecting them straight back to Google would be surprising.
      if (opts.reason === "expired") {
        await router.navigate({
          to: "/sign-in",
          search: opts.returnTo ? { returnTo: opts.returnTo } : {},
        });
      } else {
        await router.navigate({ to: "/" });
      }
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
  // `undefined` until the first getSession() resolves. Routes don't depend
  // on this value (they call getSession() directly in beforeLoad); this
  // just gives in-tree consumers an honest three-state signal instead of
  // a spurious "signed-out" flicker for a persisted session.
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);

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
