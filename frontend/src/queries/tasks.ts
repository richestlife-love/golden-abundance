// frontend/src/queries/tasks.ts
import { queryOptions } from "@tanstack/react-query";
import * as api from "../api/tasks";
import { qk } from "./keys";

export const taskQueryOptions = (uuid: string) =>
  queryOptions({
    queryKey: qk.task(uuid),
    queryFn: () => api.getTask(uuid),
    staleTime: 60_000,
  });
