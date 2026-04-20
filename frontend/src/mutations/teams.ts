// frontend/src/mutations/teams.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/teams";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type TeamUpdate = components["schemas"]["TeamUpdate"];

export function useCreateJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => api.createJoinRequest(teamId),
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
    },
  });
}

export function useCancelJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.cancelJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
    },
  });
}

export function useApproveJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.approveJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}

export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.rejectJoinRequest(teamId, reqId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
    },
  });
}

export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => api.leaveTeam(teamId),
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}

export function usePatchTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: TeamUpdate }) =>
      api.patchTeam(teamId, body),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
