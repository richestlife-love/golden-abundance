// frontend/src/api/rank.ts
import type { components, paths } from "./schema";
import { apiFetch } from "./client";

// Derived from the backend's generated OpenAPI rather than hand-maintained.
// If the backend changes the accepted period set (adds "quarter", drops
// "all_time", etc.), `just gen-types` regenerates `schema.d.ts` and the
// drift lands in every caller at typecheck time — no drift-guard unit
// test needed.
export type RankPeriod = NonNullable<
  NonNullable<paths["/api/v1/rank/users"]["get"]["parameters"]["query"]>["period"]
>;

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
