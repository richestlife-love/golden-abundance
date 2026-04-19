import { createRoute, Outlet, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: "/" });
    }
    if (!context.auth.profileComplete) {
      throw redirect({ to: "/welcome" });
    }
  },
  component: Outlet,
});
