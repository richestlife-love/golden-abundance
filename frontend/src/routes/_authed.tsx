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
