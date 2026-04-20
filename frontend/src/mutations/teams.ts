// frontend/src/mutations/teams.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/teams";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";
import { pushToast } from "../ui/toasts";
import { pushSuccess } from "../ui/useUIState";

type TeamUpdate = components["schemas"]["TeamUpdate"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];

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
    onMutate: async ({ teamId, reqId }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId && team.requests) {
        const req = team.requests.find((r) => r.id === reqId);
        if (req) {
          qc.setQueryData<MeTeamsResponse>(qk.myTeams, {
            ...prev,
            led: {
              ...team,
              members: [...(team.members ?? []), req.user],
              requests: team.requests.filter((r) => r.id !== reqId),
            },
          });
        }
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "審核失敗，請再試一次" });
    },
    onSuccess: (team) => {
      // §6.4: success overlay when approval fills the team to cap.
      if ((team.members?.length ?? 0) >= team.cap) {
        pushSuccess({
          color: "#ff5c8a",
          points: 120,
          bonus: null,
          title: "組隊完成！",
        });
      }
    },
    onSettled: (_data, _err, { teamId }) => {
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
    onMutate: async ({ teamId, reqId }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId && team.requests) {
        qc.setQueryData<MeTeamsResponse>(qk.myTeams, {
          ...prev,
          led: { ...team, requests: team.requests.filter((r) => r.id !== reqId) },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "操作失敗" });
    },
    onSettled: (_data, _err, { teamId }) => {
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
    onMutate: async ({ teamId, body }) => {
      await qc.cancelQueries({ queryKey: qk.myTeams });
      const prev = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      const team = prev?.led;
      if (prev && team && team.id === teamId) {
        qc.setQueryData<MeTeamsResponse>(qk.myTeams, {
          ...prev,
          led: {
            ...team,
            name: body.name ?? team.name,
            alias: body.alias ?? team.alias,
            topic: body.topic ?? team.topic,
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
      pushToast({ kind: "error", message: "儲存失敗" });
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
