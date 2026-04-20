// frontend/src/mutations/me.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/me";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type ProfileCreate = components["schemas"]["ProfileCreate"];
type ProfileUpdate = components["schemas"]["ProfileUpdate"];

export function useCompleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileCreate) => api.postProfile(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: qk.myTasks });
    },
  });
}

export function usePatchMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => api.patchMe(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      qc.invalidateQueries({ queryKey: qk.myTeams });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}
