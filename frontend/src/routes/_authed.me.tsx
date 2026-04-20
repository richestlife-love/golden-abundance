import { createRoute } from "@tanstack/react-router";
import MyScreen from "../screens/MyScreen";
import { myTeamsQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

export const meRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/me",
  loader: ({ context }) => context.queryClient.ensureQueryData(myTeamsQueryOptions()),
  component: MyScreen,
});
