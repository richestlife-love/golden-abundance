import { createRoute, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import GoogleAuthScreen from "../screens/GoogleAuthScreen";
import { useAuth } from "../auth/session";
import { tokenStore } from "../auth/token";
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
      onSelectAccount={async (email) => {
        await signIn(email);
        // Navigate back through the index guard so the me redirect chain
        // (/home vs /welcome) picks the right destination — avoids a stale
        // /sign-in screen after a successful token exchange.
        navigate({ to: search.returnTo ?? "/" });
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
    if (!tokenStore.get()) return;
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    throw redirect({ to: me.profile_complete ? "/home" : "/welcome" });
  },
  component: SignInRoute,
});
