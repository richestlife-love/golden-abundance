import { createRoute } from "@tanstack/react-router";
import RewardsScreen from "../screens/RewardsScreen";
import { myRewardsQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

export const rewardsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/rewards",
  loader: ({ context }) => context.queryClient.ensureQueryData(myRewardsQueryOptions()),
  component: RewardsScreen,
});
