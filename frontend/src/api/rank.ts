// frontend/src/api/rank.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

export type RankPeriod = "week" | "month" | "all_time";
type UserRankEntry = components["schemas"]["UserRankEntry"];
type TeamRankEntry = components["schemas"]["TeamRankEntry"];
type Paginated<T> = { items: T[]; next_cursor: string | null };

interface RankParams {
  period: RankPeriod;
  cursor?: string;
  limit?: number;
}

function qs(p: RankParams): string {
  const usp = new URLSearchParams({ period: p.period });
  if (p.cursor) usp.set("cursor", p.cursor);
  if (p.limit) usp.set("limit", String(p.limit));
  return `?${usp.toString()}`;
}

export const listUserRank = (
  p: RankParams,
): Promise<Paginated<UserRankEntry>> =>
  apiFetch<Paginated<UserRankEntry>>(`/rank/users${qs(p)}`);

export const listTeamRank = (
  p: RankParams,
): Promise<Paginated<TeamRankEntry>> =>
  apiFetch<Paginated<TeamRankEntry>>(`/rank/teams${qs(p)}`);
