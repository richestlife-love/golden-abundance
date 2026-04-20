// frontend/src/api/teams.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type Team = components["schemas"]["Team"];
type TeamRef = components["schemas"]["TeamRef"];
type TeamUpdate = components["schemas"]["TeamUpdate"];
type JoinRequest = components["schemas"]["JoinRequest"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

export interface TeamSearchParams {
  q?: string;
  topic?: string;
  leader_display_id?: string;
  cursor?: string;
  limit?: number;
}

function qs(params: TeamSearchParams): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const listTeams = (
  params: TeamSearchParams = {},
): Promise<Paginated<TeamRef>> =>
  apiFetch<Paginated<TeamRef>>(`/teams${qs(params)}`);

export const getTeam = (id: string): Promise<Team> =>
  apiFetch<Team>(`/teams/${id}`);

export const patchTeam = (id: string, body: TeamUpdate): Promise<Team> =>
  apiFetch<Team>(`/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const createJoinRequest = (teamId: string): Promise<JoinRequest> =>
  apiFetch<JoinRequest>(`/teams/${teamId}/join-requests`, { method: "POST" });

export const cancelJoinRequest = (
  teamId: string,
  reqId: string,
): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/join-requests/${reqId}`, {
    method: "DELETE",
  });

export const approveJoinRequest = (
  teamId: string,
  reqId: string,
): Promise<Team> =>
  apiFetch<Team>(`/teams/${teamId}/join-requests/${reqId}/approve`, {
    method: "POST",
  });

export const rejectJoinRequest = (
  teamId: string,
  reqId: string,
): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/join-requests/${reqId}/reject`, {
    method: "POST",
  });

export const leaveTeam = (teamId: string): Promise<void> =>
  apiFetch<void>(`/teams/${teamId}/leave`, { method: "POST" });
