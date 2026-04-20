// frontend/src/queries/me.ts
import { queryOptions } from "@tanstack/react-query";
import * as api from "../api/me";
import { qk } from "./keys";

export const meQueryOptions = () =>
  queryOptions({
    queryKey: qk.me,
    queryFn: () => api.getMe(),
    staleTime: 60_000,
  });

export const myTasksQueryOptions = () =>
  queryOptions({
    queryKey: qk.myTasks,
    queryFn: () => api.getMyTasks(),
    staleTime: 30_000,
  });

export const myTeamsQueryOptions = () =>
  queryOptions({
    queryKey: qk.myTeams,
    queryFn: () => api.getMyTeams(),
    staleTime: 60_000,
  });

export const myRewardsQueryOptions = () =>
  queryOptions({
    queryKey: qk.myRewards,
    queryFn: () => api.getMyRewards(),
    staleTime: 30_000,
  });
