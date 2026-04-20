import { useSuspenseQuery } from "@tanstack/react-query";
import { meQueryOptions } from "../queries/me";

export function useMe() {
  return useSuspenseQuery(meQueryOptions());
}
