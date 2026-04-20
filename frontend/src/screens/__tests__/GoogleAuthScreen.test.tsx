import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "../../test/renderRoute";
import { tokenStore } from "../../auth/token";

describe("GoogleAuthScreen via /sign-in", () => {
  it("clicking a demo account signs in and lands on /home", async () => {
    const { router } = renderRoute("/sign-in");
    const btn = await screen.findByRole("button", { name: /金杰/ });
    fireEvent.click(btn);
    await waitFor(() => expect(tokenStore.get()).toBeTruthy());
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });
});
