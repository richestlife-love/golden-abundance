// frontend/src/mutations/teams.ts
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import * as api from "../api/teams";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";
import { pushToast } from "../ui/toasts";
import { pushSuccess } from "../ui/useUIState";

type TeamUpdate = components["schemas"]["TeamUpdate"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type LedTeam = NonNullable<MeTeamsResponse["led"]>;
type Task = components["schemas"]["Task"];

type LedTeamContext = { prev: MeTeamsResponse | undefined };

// Optimistically patch the led-team branch of the myTeams cache. Skips the
// write when the cached led team isn't the one being mutated, returning the
// snapshot either way so onError can roll back.
async function patchLedTeam(
  qc: QueryClient,
  teamId: string,
  patcher: (team: LedTeam) => LedTeam,
): Promise<LedTeamContext> {
  await qc.cancelQueries({ queryKey: qk.myTeams });
  const prev = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
  const team = prev?.led;
  if (prev && team && team.id === teamId) {
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { ...prev, led: patcher(team) });
  }
  return { prev };
}

function rollbackLedTeam(qc: QueryClient, ctx: LedTeamContext | undefined): void {
  if (ctx?.prev) qc.setQueryData(qk.myTeams, ctx.prev);
}

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
    onMutate: ({ teamId, reqId }) =>
      patchLedTeam(qc, teamId, (team) => {
        const req = team.requests?.find((r) => r.id === reqId);
        if (!req) return team;
        return {
          ...team,
          members: [...(team.members ?? []), req.user],
          requests: (team.requests ?? []).filter((r) => r.id !== reqId),
        };
      }),
    onError: (_err, _vars, ctx) => {
      rollbackLedTeam(qc, ctx);
      pushToast({ kind: "error", message: "審核失敗，請再試一次" });
    },
    onSuccess: (team) => {
      // §6.4: success overlay when approval fills the team to cap. The cap
      // lives on the T3 challenge task def (not on the team row), so read
      // the challenge from the cache and compare against its cap.
      const tasks = qc.getQueryData<Task[]>(qk.myTasks);
      const challenge = tasks?.find((t) => t.is_challenge);
      if (challenge?.cap != null && (team.members?.length ?? 0) + 1 >= challenge.cap) {
        pushSuccess({
          color: challenge.color,
          points: challenge.points,
          bonus: challenge.bonus,
          title: "組隊完成！",
        });
      }
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.leaderboardAll });
    },
  });
}

export function useRejectJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, reqId }: { teamId: string; reqId: string }) =>
      api.rejectJoinRequest(teamId, reqId),
    onMutate: ({ teamId, reqId }) =>
      patchLedTeam(qc, teamId, (team) =>
        team.requests
          ? { ...team, requests: team.requests.filter((r) => r.id !== reqId) }
          : team,
      ),
    onError: (_err, _vars, ctx) => {
      rollbackLedTeam(qc, ctx);
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
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.leaderboardAll });
    },
  });
}

export function usePatchTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: string; body: TeamUpdate }) =>
      api.patchTeam(teamId, body),
    onMutate: ({ teamId, body }) =>
      patchLedTeam(qc, teamId, (team) => ({
        ...team,
        name: body.name ?? team.name,
        alias: body.alias ?? team.alias,
        topic: body.topic ?? team.topic,
      })),
    onError: (_err, _vars, ctx) => {
      rollbackLedTeam(qc, ctx);
      pushToast({ kind: "error", message: "儲存失敗" });
    },
    onSettled: (_data, _err, { teamId }) => {
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.team(teamId) });
      qc.invalidateQueries({ queryKey: qk.teamsAll });
    },
  });
}
