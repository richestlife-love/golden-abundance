// frontend/src/api/news.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type NewsItem = components["schemas"]["NewsItem"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

export const listNews = (
  cursor?: string,
  limit?: number,
): Promise<Paginated<NewsItem>> => {
  const usp = new URLSearchParams();
  if (cursor) usp.set("cursor", cursor);
  if (limit) usp.set("limit", String(limit));
  const s = usp.toString();
  return apiFetch<Paginated<NewsItem>>(`/news${s ? `?${s}` : ""}`);
};
