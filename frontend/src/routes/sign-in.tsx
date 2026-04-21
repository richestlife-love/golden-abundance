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
