import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/msw/server";
import { apiFetch, setSessionExpiredHandler } from "../client";
import { ApiError } from "../errors";
import { tokenStore } from "../../auth/token";

afterEach(() => {
  setSessionExpiredHandler(null);
  tokenStore.clear();
});

describe("apiFetch", () => {
  it("sends Authorization: Bearer when token is set", async () => {
    let seenAuth: string | null = null;
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    tokenStore.set("token-abc");
    await apiFetch("/me");
    expect(seenAuth).toBe("Bearer token-abc");
  });

  it("omits Authorization when no token", async () => {
    let seenAuth: string | null = "<unset>";
    server.use(
      http.get("/api/v1/me", ({ request }) => {
        seenAuth = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/me");
    expect(seenAuth).toBeNull();
  });

  it("returns parsed JSON on 200", async () => {
    server.use(http.get("/api/v1/me", () => HttpResponse.json({ x: 1 })));
    const data = await apiFetch<{ x: number }>("/me");
    expect(data).toEqual({ x: 1 });
  });

  it("returns undefined on 204", async () => {
    server.use(
      http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })),
    );
    const data = await apiFetch<void>("/auth/logout", { method: "POST" });
    expect(data).toBeUndefined();
  });

  it("throws ApiError with detail on non-2xx", async () => {
    server.use(
      http.get("/api/v1/teams/x", () =>
        HttpResponse.json({ detail: "team not found" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/teams/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      detail: "team not found",
    });
  });

  it("falls back to statusText when body lacks detail", async () => {
    server.use(
      http.get("/api/v1/me", () =>
        HttpResponse.text("not json", { status: 500, statusText: "Server Error" }),
      ),
    );
    await expect(apiFetch("/me")).rejects.toMatchObject({
      status: 500,
      detail: "Server Error",
    });
  });

  it("calls registered session-expired handler on 401", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    server.use(
      http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })),
    );
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      returnTo: expect.any(String),
    });
  });

  it("does not throw when no 401 handler is registered", async () => {
    server.use(
      http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })),
    );
    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });
});
