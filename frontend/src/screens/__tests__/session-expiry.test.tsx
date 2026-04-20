// End-to-end regression: when an authed query returns 401, the 401
// interceptor in api/client.ts fires setSessionExpiredHandler, which
// signOut-navigates the (test) router to /sign-in?returnTo=<prev> and
// pushes the expiry toast. The test asserts all three observables.

import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { server } from "../../test/msw/server";
import { renderRoute } from "../../test/renderRoute";
import { tokenStore } from "../../auth/token";

describe("401 interceptor — session expiry", () => {
  it("redirects to /sign-in?returnTo=<prev> and shows toast on 401", async () => {
    // Every authed query returns 401. /me is the first to fire (it's the
    // source of identity for every _authed screen), so one override there
    // is enough to trigger the interceptor path.
    server.use(http.get("/api/v1/me", () => new HttpResponse(null, { status: 401 })));

    const { router } = renderRoute("/me", { token: "expired-token" });

    await waitFor(() => expect(router.state.location.pathname).toBe("/sign-in"));
    expect(router.state.location.search).toMatchObject({
      returnTo: expect.stringContaining("/me"),
    });
    expect(tokenStore.get()).toBeNull();
    await waitFor(() =>
      expect(screen.getByText(/工作階段已過期/)).toBeInTheDocument(),
    );
  });
});
