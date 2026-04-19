// Client-side types for the prototype. These describe the current mock-data
// shapes — loose, optional-heavy, camelCase. Phase 4 replaces them with
// types generated from the FastAPI/Pydantic contract (snake_case, UUIDs).

export type TaskTag = "探索" | "社区" | "陪伴";
export type TaskStatus = "todo" | "in_progress" | "completed" | "expired";
export type EffectiveTaskStatus = TaskStatus | "locked";

export type TaskStep = {
  label: string;
  done: boolean;
};

export type TeamProgress = {
  total: number;
  cap: number;
  ledTotal: number;
  joinedTotal: number;
};

export type Task = {
  id: number;
  title: string;
  due: string | null;
  daysLeft: number | null;
  color: string;
  points: number;
  tag: TaskTag;
  bonus: string | null;
  status: TaskStatus;
  progress?: number;
  summary: string;
  description: string;
  estMinutes: number;
  steps?: TaskStep[];
  requires?: number[];
  cap?: number;
  teamProgress?: TeamProgress | null;
  isChallenge?: boolean;
};

export type User = {
  id: string; // "U" + derived suffix
  email: string;
  name: string;
  avatar?: string; // CSS gradient string from mock auth; Phase 4 maps to OAuth picture URL
  zhName?: string;
  enName?: string;
  nickname?: string;
  phone?: string;
  phoneCode?: string;
  lineId?: string;
  telegramId?: string;
  country?: string;
  location?: string;
};

export type TeamMemberRef = {
  id: string;
  name: string;
  avatar: string; // CSS gradient string
};

export type JoinRequest = {
  id: string;
  name: string;
  avatar: string;
};

export type TeamRole = "leader" | "member";

// Team as carried in App state. `requests` is leader-only. `status`/`currentCount`
// are only set on the joined-team branch (pending → approved flow).
export type Team = {
  id: string; // "T-..." format
  role: TeamRole;
  name: string;
  alias?: string;
  topic: string;
  leader: TeamMemberRef;
  members: TeamMemberRef[];
  requests?: JoinRequest[];
  cap?: number;
  points?: number; // carried from MockTeam on the joined-team path; not set on ledTeam
  weekPoints?: number; // carried from MockTeam on the joined-team path; not set on ledTeam
  rank?: number; // carried from MockTeam on the joined-team path; not set on ledTeam
  status?: "pending" | "approved";
  currentCount?: number;
};

// Mock leaderboard team entry (see MOCK_TEAMS). Differs from the in-app Team
// used for ledTeam/joinedTeam: flat `members`/`leader` counts, no `role`.
export type MockTeam = {
  id: string;
  name: string;
  leader: string;
  leaderId: string;
  topic: string;
  members: number;
  cap: number;
  points: number;
  weekPoints: number;
  rank: number;
  leaderAvatar: string;
};

export type MockMember = {
  id: string;
  name: string;
  role: string; // job/skill label, e.g. "設計美編"
  avatar: string;
};

// Success overlay payload used by FormSuccessOverlay.
export type SuccessData = {
  color: string;
  points: number;
  bonus: string | null;
  title?: string;
};
