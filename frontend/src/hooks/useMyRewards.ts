import { useSuspenseQuery } from "@tanstack/react-query";
import { myRewardsQueryOptions } from "../queries/me";

export function useMyRewards() {
  return useSuspenseQuery(myRewardsQueryOptions());
}
