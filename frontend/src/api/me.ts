// frontend/src/api/me.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type User = components["schemas"]["User"];
type Task = components["schemas"]["Task"];
type Reward = components["schemas"]["Reward"];
type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type MeProfileCreateResponse = components["schemas"]["MeProfileCreateResponse"];
type ProfileCreate = components["schemas"]["ProfileCreate"];
type ProfileUpdate = components["schemas"]["ProfileUpdate"];

export const getMe = (): Promise<User> => apiFetch<User>("/me");
export const getMyTasks = (): Promise<Task[]> => apiFetch<Task[]>("/me/tasks");
export const getMyTeams = (): Promise<MeTeamsResponse> =>
  apiFetch<MeTeamsResponse>("/me/teams");
export const getMyRewards = (): Promise<Reward[]> =>
  apiFetch<Reward[]>("/me/rewards");

export const postProfile = (
  body: ProfileCreate,
): Promise<MeProfileCreateResponse> =>
  apiFetch<MeProfileCreateResponse>("/me/profile", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchMe = (body: ProfileUpdate): Promise<User> =>
  apiFetch<User>("/me", { method: "PATCH", body: JSON.stringify(body) });
