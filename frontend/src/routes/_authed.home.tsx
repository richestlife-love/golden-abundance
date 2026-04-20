import { createRoute } from "@tanstack/react-router";
import HomeScreen from "../screens/HomeScreen";
import { myTasksQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

export const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/home",
  loader: ({ context }) => context.queryClient.ensureQueryData(myTasksQueryOptions()),
  component: HomeScreen,
});
