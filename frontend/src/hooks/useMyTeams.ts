import { useSuspenseQuery } from "@tanstack/react-query";
import { myTeamsQueryOptions } from "../queries/me";

export function useMyTeams() {
  return useSuspenseQuery(myTeamsQueryOptions());
}
