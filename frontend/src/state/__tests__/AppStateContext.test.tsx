import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppStateProvider, useAppState } from "../AppStateContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

describe("AppStateContext", () => {
  it("starts with a null user and the TASKS fixture", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.tasks.length).toBeGreaterThan(0);
  });

  it("handleSignIn sets the user with a derived id", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => {
      result.current.handleSignIn({
        email: "jet@example.com",
        name: "Jet",
        avatar: "linear-gradient(...)",
      });
    });
    expect(result.current.user?.id).toMatch(/^U[A-Z0-9]+$/);
    expect(result.current.user?.email).toBe("jet@example.com");
  });

  it("handleSignOut clears user and teams", () => {
    const { result } = renderHook(() => useAppState(), { wrapper });
    act(() => {
      result.current.handleSignIn({ email: "a@b.com", name: "A", avatar: "" });
    });
    act(() => result.current.handleSignOut());
    expect(result.current.user).toBeNull();
    expect(result.current.ledTeam).toBeNull();
    expect(result.current.joinedTeam).toBeNull();
  });
});
