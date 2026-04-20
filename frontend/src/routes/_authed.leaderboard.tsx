import { createRoute } from "@tanstack/react-router";
import RankScreen from "../screens/RankScreen";
import {
  rankTeamsInfiniteQueryOptions,
  rankUsersInfiniteQueryOptions,
} from "../queries/rank";
import { authedRoute } from "./_authed";

export const leaderboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/leaderboard",
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureInfiniteQueryData(rankUsersInfiniteQueryOptions("week")),
      context.queryClient.ensureInfiniteQueryData(rankTeamsInfiniteQueryOptions("week")),
    ]),
  component: RankScreen,
});
