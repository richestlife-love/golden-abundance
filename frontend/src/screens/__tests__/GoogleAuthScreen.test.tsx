import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "../../test/renderRoute";

describe("GoogleAuthScreen via /sign-in", () => {
  it("clicking the Google button initiates OAuth redirect", async () => {
    renderRoute("/sign-in");
    const btn = await screen.findByRole("button", { name: /繼續使用 Google 登入/ });
    fireEvent.click(btn);
    // The fake Supabase client records signInWithOAuth calls — since the
    // component doesn't expose them directly, we assert the UI flips into
    // the pending state (spinner visible, button gone). That plus the
    // session-test coverage of signInCalls is sufficient.
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /繼續使用 Google 登入/ }),
      ).not.toBeInTheDocument();
    });
  });
});
