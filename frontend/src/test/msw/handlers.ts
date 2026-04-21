import { http, HttpResponse } from "msw";
import * as f from "./fixtures";

export const defaultHandlers = [
  http.get("/api/v1/me", () => HttpResponse.json(f.userJet)),
  http.get("/api/v1/me/tasks", () => HttpResponse.json(f.tasksList)),
  http.get("/api/v1/me/teams", () => HttpResponse.json(f.myTeams)),
  http.get("/api/v1/me/rewards", () => HttpResponse.json(f.rewardsList)),
  http.get("/api/v1/tasks/:id", ({ params }) => {
    const t = f.tasksList.find((x) => x.id === params.id);
    return t
      ? HttpResponse.json(t)
      : HttpResponse.json({ detail: "Task not found" }, { status: 404 });
  }),
  http.get("/api/v1/news", () => HttpResponse.json({ items: f.newsList, next_cursor: null })),
  http.get("/api/v1/leaderboard/users", () => HttpResponse.json({ items: [], next_cursor: null })),
  http.get("/api/v1/leaderboard/teams", () => HttpResponse.json({ items: [], next_cursor: null })),
  http.get("/api/v1/teams", () => HttpResponse.json({ items: [], next_cursor: null })),
];
