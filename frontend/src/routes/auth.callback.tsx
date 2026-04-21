import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { rootRoute } from "./__root";
import { getSupabaseClient } from "../lib/supabase";
import { parseReturnTo } from "../lib/returnTo";
import { pushToast } from "../ui/toasts";

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
      if (error) {
        // Surface the failure so the user isn't left staring at a spinner
        // that vanishes into /sign-in without explanation. TODO(phase-7b):
        // also send to Sentry with the supabase error code as a tag.
        pushToast({
          kind: "error",
          message: `登入失敗：${error.message || "請再試一次"}`,
        });
        navigate({ to: "/sign-in" });
        return;
      }
      navigate({ to: search.returnTo ?? "/" });
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
    returnTo: parseReturnTo(raw.returnTo),
  }),
  component: AuthCallbackRoute,
});
