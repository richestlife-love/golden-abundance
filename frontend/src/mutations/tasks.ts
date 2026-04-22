// frontend/src/mutations/tasks.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/tasks";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";
import { pushSuccess } from "../ui/useUIState";

type SubmitBody =
  | components["schemas"]["InterestFormBody"]
  | components["schemas"]["TicketFormBody"];

export function useSubmitTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubmitBody }) => api.submitTask(id, body),
    onSuccess: (data, { id }) => {
      if (data.reward) {
        pushSuccess({
          color: data.task.color,
          points: data.task.points,
          bonus: data.reward.bonus,
        });
      }
      qc.invalidateQueries({ queryKey: qk.task(id) });
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.leaderboardAll });
    },
  });
}
