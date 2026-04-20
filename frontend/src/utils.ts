import type { components } from "./api/schema";

type Task = components["schemas"]["Task"];
type EffectiveTaskStatus = Task["status"] | "locked";

export function getEffectiveStatus(
  t: Task,
  allTasks: Task[],
): { status: EffectiveTaskStatus; unmet: string[] } {
  const completedIds = new Set(
    allTasks.filter((x) => x.status === "completed").map((x) => x.id),
  );
  const unmet = (t.requires ?? []).filter((rid) => !completedIds.has(rid));
  return unmet.length > 0 ? { status: "locked", unmet } : { status: t.status, unmet: [] };
}

// Days from today until the given ISO datetime (ceil). Negative = past due.
// Returns null when no due date. Tasks rename: due_at replaces daysLeft.
export function daysUntil(dueAt: string | null | undefined): number | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

// px → rem at the default 16px root. Use for fontSize so iOS accessibility
// text-size preferences scale typography.
export const fs = (px: number): string => `${px / 16}rem`;
