import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { setSessionExpiredHandler } from "../api/client";
import { qk } from "../queries/keys";
import { pushToast } from "../ui/toasts";
import { getRouterRef } from "../router";
import { tokenStore } from "./token";

export interface SignOutOpts {
  reason?: "expired" | "user";
  returnTo?: string;
}

interface AuthCtx {
  isSignedIn: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: (opts?: SignOutOpts) => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

let inFlightSignOut = false;

async function performLogoutBestEffort(token: string): Promise<void> {
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort; ignore network failures
  }
}

// Module-level QueryClient + signOut — both live outside React so the 401
// interceptor (registered at module-load time) and module-level signOut can
// fire without waiting for AuthProvider to mount.
let activeQueryClient: QueryClient | null = null;
export function _setActiveQueryClient(qc: QueryClient | null): void {
  activeQueryClient = qc;
}

export async function signOut(opts: SignOutOpts = {}): Promise<void> {
  if (inFlightSignOut) return;
  inFlightSignOut = true;
  try {
    const token = tokenStore.get();
    if (token) void performLogoutBestEffort(token);
    if (opts.reason === "expired") {
      pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
    }
    tokenStore.clear();
    const router = getRouterRef();
    if (router) {
      await router.navigate({
        to: "/sign-in",
        search: opts.returnTo ? { returnTo: opts.returnTo } : {},
      });
    }
    // Cache clear last so any in-flight queries don't refetch with the
    // (now-cleared) token mid-teardown.
    activeQueryClient?.clear();
  } finally {
    inFlightSignOut = false;
  }
}

setSessionExpiredHandler(({ returnTo }) => {
  void signOut({ reason: "expired", returnTo });
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean>(() => !!tokenStore.get());

  useEffect(() => {
    _setActiveQueryClient(qc);
    return () => _setActiveQueryClient(null);
  }, [qc]);

  const signIn = useCallback(
    async (email: string) => {
      const res = await authApi.postGoogleAuth({ id_token: email });
      tokenStore.set(res.access_token);
      qc.setQueryData(qk.me, res.user);
      setSignedIn(true);
    },
    [qc],
  );

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
