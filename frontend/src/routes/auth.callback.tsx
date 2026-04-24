import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { rootRoute } from "./__root";
import { getSupabaseClient } from "../lib/supabase";
import { parseReturnTo } from "../lib/returnTo";
import { pushToast } from "../ui/toasts";

interface CallbackSearch {
  code?: string;
  error?: string;
  error_description?: string;
  returnTo?: string;
}

function str(raw: unknown): string | undefined {
  return typeof raw === "string" && raw ? raw : undefined;
}

function AuthCallbackRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" });
  // PKCE codes are one-shot: exchangeCodeForSession reads the verifier from
  // localStorage and deletes it on success. React StrictMode (dev) re-runs
  // effects, so without this guard the second run sees an empty verifier and
  // fails with "PKCE code verifier not found in storage".
  const exchangeStartedRef = useRef(false);

  useEffect(() => {
    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;
    const supabase = getSupabaseClient();
    void (async () => {
      // PKCE: Supabase redirected here with `?code=<pkce-code>`. The SDK's
      // exchangeCodeForSession expects JUST the code value — it sends its
      // argument verbatim as the `auth_code` POST body. Passing a query
      // string here yields "invalid flow state, no valid flow state found".
      if (!search.code) {
        const providerErr = search.error_description ?? search.error;
        pushToast({
          kind: "error",
          message: `登入失敗：${providerErr || "缺少驗證碼，請再試一次"}`,
        });
        navigate({ to: "/sign-in" });
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(search.code);
      if (error) {
        // Surface the failure so the user isn't left staring at a spinner
        // that vanishes into /sign-in without explanation. TODO: also send
        // to Sentry with the supabase error code as a tag.
        pushToast({
          kind: "error",
          message: `登入失敗：${error.message || "請再試一次"}`,
        });
        navigate({ to: "/sign-in" });
        return;
      }
      navigate({ to: search.returnTo ?? "/" });
    })();
  }, [navigate, search.code, search.error, search.error_description, search.returnTo]);

  // TODO: add a skeleton page for the destination route.
  return null;
}

export const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  validateSearch: (raw: Record<string, unknown>): CallbackSearch => ({
    code: str(raw.code),
    error: str(raw.error),
    error_description: str(raw.error_description),
    returnTo: parseReturnTo(raw.returnTo),
  }),
  component: AuthCallbackRoute,
});
