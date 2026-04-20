import { useSuspenseQuery } from "@tanstack/react-query";
import { myTasksQueryOptions } from "../queries/me";

export function useMyTasks() {
  return useSuspenseQuery(myTasksQueryOptions());
}
