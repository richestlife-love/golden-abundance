import type { components } from "./api/schema";

type Task = components["schemas"]["Task"];
type EffectiveTaskStatus = Task["status"] | "locked";
export type EffectiveStatus = { status: EffectiveTaskStatus; unmet: string[] };

function computeEffective(t: Task, completedIds: Set<string>): EffectiveStatus {
  const unmet = (t.requires ?? []).filter((rid) => !completedIds.has(rid));
  return unmet.length > 0 ? { status: "locked", unmet } : { status: t.status, unmet: [] };
}

export function getEffectiveStatus(t: Task, allTasks: Task[]): EffectiveStatus {
  const completedIds = new Set(allTasks.filter((x) => x.status === "completed").map((x) => x.id));
  return computeEffective(t, completedIds);
}

// Batched variant — builds the completed-ids Set once so callers iterating
// over a list avoid the O(n²) Set allocation of repeated getEffectiveStatus
// calls.
export function getEffectiveStatuses(tasks: Task[]): Map<string, EffectiveStatus> {
  const completedIds = new Set(tasks.filter((x) => x.status === "completed").map((x) => x.id));
  return new Map(tasks.map((t) => [t.id, computeEffective(t, completedIds)]));
}

// Days from today until the given ISO datetime (ceil). Negative = past due.
// Returns null when no due date. Tasks rename: due_at replaces daysLeft.
export function daysUntil(dueAt: string | null | undefined): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

// Deterministic FNV-style string hash — stable across browsers so seeded
// placeholder values (avatar colors, mock points) stay consistent across
// sessions and devices.
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// Deterministic avatar background (URL when available, otherwise a
// name-hashed gradient). Keeps the prototype's vivid circular avatars
// intact while the backend may return null avatar_url for seeded users.
const AVATAR_COLORS = ["#fed234", "#fec701", "#8AD4B0", "#B8A4E3", "#FFC170", "#6dae4a"];
export function avatarBg(avatarUrl: string | null | undefined, seed: string): string {
  if (avatarUrl) return `url(${avatarUrl}) center/cover`;
  const color = AVATAR_COLORS[Math.abs(hashString(seed)) % AVATAR_COLORS.length];
  return `linear-gradient(135deg, ${color}, ${color}CC)`;
}

// px → rem at the default 16px root. Use for fontSize so iOS accessibility
// text-size preferences scale typography.
export const fs = (px: number): string => `${px / 16}rem`;
