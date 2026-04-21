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
