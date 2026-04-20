// frontend/src/mutations/tasks.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/tasks";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type SubmitBody =
  | components["schemas"]["InterestFormBody"]
  | components["schemas"]["TicketFormBody"];

export function useSubmitTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmitBody }) =>
      api.submitTask(id, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.task(id) });
      qc.invalidateQueries({ queryKey: qk.myTasks });
      qc.invalidateQueries({ queryKey: qk.myRewards });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: ["rank"] });
    },
  });
}
