import type { Task, EffectiveTaskStatus } from "./types";

export function getEffectiveStatus(
  t: Task,
  allTasks: Task[],
): { status: EffectiveTaskStatus; unmet: number[] } {
  const completedIds = new Set(allTasks.filter((x) => x.status === "completed").map((x) => x.id));
  const unmet = (t.requires || []).filter((rid) => !completedIds.has(rid));
  return unmet.length > 0 ? { status: "locked", unmet } : { status: t.status, unmet: [] };
}
