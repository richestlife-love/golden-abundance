import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { AuthError } from "@supabase/supabase-js";
import { renderRoute } from "../../test/renderRoute";

describe("/auth/callback", () => {
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
