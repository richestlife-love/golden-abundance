// frontend/src/queries/news.ts
import { infiniteQueryOptions } from "@tanstack/react-query";
import * as api from "../api/news";
import { qk } from "./keys";

export const newsInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: qk.news,
    queryFn: ({ pageParam }) => api.listNews(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 5 * 60_000,
  });
