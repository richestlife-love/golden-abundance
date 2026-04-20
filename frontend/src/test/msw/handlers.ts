import { http, HttpResponse } from "msw";
import * as f from "./fixtures";

export const defaultHandlers = [
  http.post("/api/v1/auth/google", () => HttpResponse.json(f.authResponseJet)),
  http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
  http.get("/api/v1/me", () => HttpResponse.json(f.userJet)),
  http.get("/api/v1/me/tasks", () => HttpResponse.json(f.tasksList)),
  http.get("/api/v1/me/teams", () => HttpResponse.json(f.myTeams)),
  http.get("/api/v1/me/rewards", () => HttpResponse.json(f.rewardsList)),
  http.get("/api/v1/news", () => HttpResponse.json({ items: f.newsList, next_cursor: null })),
  http.get("/api/v1/rank/users", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get("/api/v1/rank/teams", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
  http.get("/api/v1/teams", () =>
    HttpResponse.json({ items: [], next_cursor: null }),
  ),
];
