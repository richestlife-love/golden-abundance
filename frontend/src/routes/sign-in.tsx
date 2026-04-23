import { createRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../auth/session";
import { getSupabaseClient } from "../lib/supabase";
import { parseReturnTo } from "../lib/returnTo";
import { meQueryOptions } from "../queries/me";
import { rootRoute } from "./__root";
import GoogleSpinner from "../ui/GoogleSpinner";
import { fs } from "../utils";

interface SignInSearch {
  returnTo?: string;
  error?: string;
}

function SignInRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/sign-in" });
  const { signIn } = useAuth();

  // Kick off the OAuth redirect immediately on landing — no intermediate
  // "continue with Google" screen, straight to Google's account picker.
  // Skip when we just bounced back from a failed callback (search.error)
  // so a cancellation at Google doesn't loop the user right back there.
  useEffect(() => {
    if (search.error) return;
    void signIn(search.returnTo);
  }, [search.error, search.returnTo, signIn]);

  const failed = !!search.error;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        gap: 20,
        color: "var(--fg)",
      }}
    >
      {failed ? (
        <>
          <p
            style={{
              fontSize: fs(15),
              color: "#5F6368",
              margin: 0,
              textAlign: "center",
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            登入未完成，請再試一次。
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                void signIn(search.returnTo);
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid #6dae4a",
                background: "#6dae4a",
                color: "#fff",
                cursor: "pointer",
                fontSize: fs(14),
                fontWeight: 600,
              }}
            >
              重試登入
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid #6dae4a",
                background: "#fff",
                color: "#6dae4a",
                cursor: "pointer",
                fontSize: fs(14),
                fontWeight: 600,
              }}
            >
              返回
            </button>
          </div>
        </>
      ) : (
        <>
          <GoogleSpinner />
          <p
            style={{
              fontSize: fs(14),
              color: "#5F6368",
              margin: 0,
              textAlign: "center",
            }}
          >
            正在前往 Google 登入⋯
          </p>
        </>
      )}
    </div>
  );
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (raw: Record<string, unknown>): SignInSearch => ({
    returnTo: parseReturnTo(raw.returnTo),
    // TSR's default parser coerces `?error=1` into the number 1, so we can't
    // gate on `typeof === "string"` here. Accept any truthy primitive and
    // stringify — the flag is just a retry marker, the exact value is
    // irrelevant.
    error: raw.error ? String(raw.error) : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) return;
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: SignInRoute,
});
