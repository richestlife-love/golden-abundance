import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as authApi from "../api/auth";
import { setSessionExpiredHandler } from "../api/client";
import { qk } from "../queries/keys";
import { pushToast } from "../ui/toasts";
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

// Module-level QueryClient holder — set by AuthProvider when it mounts,
// so the 401 interceptor can clear the cache without a React context.
let activeQueryClient: QueryClient | null = null;
export function _setActiveQueryClient(qc: QueryClient | null): void {
  activeQueryClient = qc;
}

// Registered at module-import time — before AuthProvider mounts. The
// handler deliberately does NOT call signOut(): signOut lives on the
// AuthProvider closure (React state + inFlightSignOut guard), which may
// not exist yet when a 401 fires (e.g. during a pre-mount loader).
// Consequence until plan 4c wires setRouterRef: useAuth().isSignedIn
// stays stale after a 401, and concurrent loader-401s bypass the
// inFlightSignOut dedup (each fires tokenStore.clear + qc.clear + toast
// independently). Plan 4c mirrors _setActiveQueryClient with
// _setActiveRouter(router) and routes both user- and
// expired-initiated logouts through signOut so state + dedup + nav all
// converge.
setSessionExpiredHandler(({ returnTo }) => {
  tokenStore.clear();
  pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
  activeQueryClient?.clear();
  void returnTo;
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

  const signOut = useCallback(
    async (opts: SignOutOpts = {}) => {
      if (inFlightSignOut) return;
      inFlightSignOut = true;
      try {
        const token = tokenStore.get();
        if (token) void performLogoutBestEffort(token);
        tokenStore.clear();
        setSignedIn(false);
        if (opts.reason === "expired") {
          pushToast({ kind: "info", message: "您的工作階段已過期，請重新登入" });
        }
        // Cache clear last so any in-flight queries don't refetch with the
        // (now-cleared) token mid-teardown.
        qc.clear();
      } finally {
        inFlightSignOut = false;
      }
    },
    [qc],
  );

  return <Ctx.Provider value={{ isSignedIn: signedIn, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
