import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "../../test/renderRoute";

describe("/sign-in", () => {
  it("auto-triggers the Google OAuth redirect on mount (no intermediate screen)", async () => {
    const { fake } = renderRoute("/sign-in");
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    expect(fake.signInCalls[0].provider).toBe("google");
    expect(fake.signInCalls[0].redirectTo).toMatch(/\/auth\/callback$/);
  });

  it("propagates returnTo into the OAuth callback URL when provided", async () => {
    const { fake } = renderRoute("/sign-in?returnTo=%2Ftasks%2FT1");
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    const url = new URL(fake.signInCalls[0].redirectTo!);
    expect(url.searchParams.get("returnTo")).toBe("/tasks/T1");
  });

  it("does not auto-trigger when ?error=1 is set (avoids callback loop)", async () => {
    const { fake } = renderRoute("/sign-in?error=1");
    // Settle any pending effects before asserting the *absence* of a call.
    await screen.findByText("登入未完成，請再試一次。");
    expect(fake.signInCalls).toHaveLength(0);
  });

  it("retry button from the error state triggers a fresh OAuth attempt", async () => {
    const { fake } = renderRoute("/sign-in?error=1&returnTo=%2Fhome");
    const retry = await screen.findByRole("button", { name: "重試登入" });
    fireEvent.click(retry);
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    const url = new URL(fake.signInCalls[0].redirectTo!);
    expect(url.searchParams.get("returnTo")).toBe("/home");
  });
});
