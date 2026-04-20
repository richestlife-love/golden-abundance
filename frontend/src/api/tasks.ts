// frontend/src/api/tasks.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type Task = components["schemas"]["Task"];
type SubmitBody =
  | components["schemas"]["InterestFormBody"]
  | components["schemas"]["TicketFormBody"];
type TaskSubmissionResponse = components["schemas"]["TaskSubmissionResponse"];

export const getTask = (id: string): Promise<Task> => apiFetch<Task>(`/tasks/${id}`);

export const submitTask = (id: string, body: SubmitBody): Promise<TaskSubmissionResponse> =>
  apiFetch<TaskSubmissionResponse>(`/tasks/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
