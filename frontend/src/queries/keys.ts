import type { RankPeriod } from "../api/rank";
import type { TeamSearchParams } from "../api/teams";

export const qk = {
  me: ["me"] as const,
  myTasks: ["me", "tasks"] as const,
  myTeams: ["me", "teams"] as const,
  myRewards: ["me", "rewards"] as const,
  task: (id: string) => ["tasks", id] as const,
  teams: (params: TeamSearchParams) => ["teams", params] as const,
  team: (id: string) => ["teams", id] as const,
  rankUsers: (period: RankPeriod) => ["rank", "users", period] as const,
  rankTeams: (period: RankPeriod) => ["rank", "teams", period] as const,
  news: ["news"] as const,
} as const;
