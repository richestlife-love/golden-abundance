import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderRoute } from "../../test/renderRoute";

describe("router scaffolding", () => {
  it("renders the landing screen at /", async () => {
    renderRoute("/");
    await waitFor(() => {
      expect(screen.getByText("金富有志工")).toBeInTheDocument();
    });
  });
});

describe("_authed layout", () => {
  it("is defined with the expected id", async () => {
    const { authedRoute } = await import("../_authed");
    expect(authedRoute.id).toContain("_authed");
  });
});

describe("public routes", () => {
  it("renders sign-in at /sign-in", async () => {
    renderRoute("/sign-in");
    // GoogleAuthScreen.tsx:98 renders "選擇帳號" (Traditional — present in source).
    await waitFor(() => {
      expect(screen.getByText("選擇帳號")).toBeInTheDocument();
    });
  });

  it("guest visiting /welcome is redirected to /sign-in", async () => {
    const { router } = renderRoute("/welcome");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
  });
});
