import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { AuthError } from "@supabase/supabase-js";
import { renderRoute } from "../../test/renderRoute";

describe("/auth/callback", () => {
  it("calls exchangeCodeForSession with just the code value (not the query string)", async () => {
    const { fake } = renderRoute("/auth/callback?code=abc&state=xyz");
    await waitFor(() => {
      expect(fake.exchangeCalls).toHaveLength(1);
    });
    // The SDK sends its arg verbatim as `auth_code` — passing the raw
    // query string triggers "invalid flow state, no valid flow state
    // found" on the server. Pin the exact value so the regression is
    // unmistakable.
    expect(fake.exchangeCalls[0]).toBe("abc");
  });

  it("skips the exchange and redirects to /sign-in when code is missing", async () => {
    const { router, fake } = renderRoute("/auth/callback?returnTo=%2Fhome");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(fake.exchangeCalls).toHaveLength(0);
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/登入失敗/);
  });

  it("surfaces the provider's error_description when the callback carries one", async () => {
    const { router, fake } = renderRoute(
      "/auth/callback?error=access_denied&error_description=User%20cancelled",
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
    expect(fake.exchangeCalls).toHaveLength(0);
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/User cancelled/);
  });

  it("navigates to returnTo on successful exchange", async () => {
    const { router } = renderRoute("/auth/callback?code=abc&returnTo=%2Fhome");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/home");
    });
  });

  it("falls back to / when returnTo is absent (index then redirects)", async () => {
    const { router } = renderRoute("/auth/callback?code=abc");
    // MSW's default `me` has profile_complete=true, so / bounces to /home.
    // The exact final landing is incidental — the point is we navigated
    // somewhere same-origin.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/home");
    });
  });

  it("strips a protocol-relative returnTo and falls back to /", async () => {
    const { router } = renderRoute("/auth/callback?code=abc&returnTo=%2F%2Fevil.com");
    // parseReturnTo strips //evil.com to undefined → falls back to / →
    // index bounces to /home. Verify we land there and nothing in the
    // router's URL mentions evil.com.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/home");
    });
    expect(router.state.location.href).not.toContain("evil.com");
  });

  it("surfaces an error toast and redirects to /sign-in when the exchange fails", async () => {
    const { router } = renderRoute("/auth/callback?code=abc", {
      configureFake: (fake) => {
        fake.nextExchangeError = { message: "invalid grant" } as AuthError;
      },
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });

    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/登入失敗/);
  });
});
