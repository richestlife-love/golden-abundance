import { describe, expect, it } from "vitest";
import { qk } from "../keys";

describe("qk", () => {
  it("static keys are stable", () => {
    expect(qk.me).toEqual(["me"]);
    expect(qk.myTasks).toEqual(["me", "tasks"]);
    expect(qk.myTeams).toEqual(["me", "teams"]);
    expect(qk.myRewards).toEqual(["me", "rewards"]);
    expect(qk.news).toEqual(["news"]);
  });

  it("task(id) shares the 'tasks' prefix with team()", () => {
    expect(qk.task("X").slice(0, 1)).toEqual(["tasks"]);
    expect(qk.team("X").slice(0, 1)).toEqual(["teams"]);
  });

  it("rank keys share the 'rank' prefix for broad invalidation", () => {
    expect(qk.rankUsers("week").slice(0, 1)).toEqual(["rank"]);
    expect(qk.rankTeams("week").slice(0, 1)).toEqual(["rank"]);
  });
});
