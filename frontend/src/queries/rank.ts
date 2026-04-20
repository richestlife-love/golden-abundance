// frontend/src/queries/rank.ts
import { infiniteQueryOptions } from "@tanstack/react-query";
import * as api from "../api/rank";
import type { RankPeriod } from "../api/rank";
import { qk } from "./keys";

export const rankUsersInfiniteQueryOptions = (period: RankPeriod) =>
  infiniteQueryOptions({
    queryKey: qk.rankUsers(period),
    queryFn: ({ pageParam }) => api.listUserRank({ period, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });

export const rankTeamsInfiniteQueryOptions = (period: RankPeriod) =>
  infiniteQueryOptions({
    queryKey: qk.rankTeams(period),
    queryFn: ({ pageParam }) => api.listTeamRank({ period, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });
