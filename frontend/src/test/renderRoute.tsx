import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { AppStateProvider, useAppState, type AppState } from "../state/AppStateContext";
import { createAppRouter } from "../router";
import type { User } from "../types";

export type SeedAuth = "guest" | "authed-incomplete" | "authed-complete";

function userForSeed(seed: SeedAuth): User | null {
  if (seed === "guest") return null;
  const base: User = {
    id: "UTEST00",
    email: "a@b.com",
    name: "A",
    avatar: "",
  };
  return seed === "authed-complete" ? { ...base, zhName: "甲" } : base;
}

function Shell({
  router,
  stateRef,
}: {
  router: ReturnType<typeof createAppRouter>;
  stateRef: { current: AppState | null };
}) {
  const state = useAppState();
  const { user, profileComplete } = state;
  useEffect(() => {
    stateRef.current = state;
  });
  useEffect(() => {
    router.invalidate();
  }, [router, user, profileComplete]);
  return (
    <RouterProvider
      router={router}
      context={{
        auth: { user: user ? { id: user.id } : null, profileComplete },
      }}
    />
  );
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
  getState: () => AppState;
}

export function renderRoute(
  path: string,
  opts: { seed?: SeedAuth } = {},
): RenderRouteResult {
  const seed = opts.seed ?? "guest";
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    initialContext: {
      auth: {
        user: seed === "guest" ? null : { id: "UTEST00" },
        profileComplete: seed === "authed-complete",
      },
    },
  });
  const stateRef: { current: AppState | null } = { current: null };
  const dom = render(
    <AppStateProvider initialUser={userForSeed(seed)}>
      <Shell router={router} stateRef={stateRef} />
    </AppStateProvider>,
  );
  const getState = (): AppState => {
    if (!stateRef.current) throw new Error("AppState not yet mounted");
    return stateRef.current;
  };
  return { router, dom, getState };
}

// Assert both the URL and a string unique to the destination screen. URL-only
// checks miss bugs where the router navigates but the component never mounts
// (e.g., nested-route with no <Outlet/> on the parent).
export async function expectScreen(
  router: ReturnType<typeof createAppRouter>,
  path: string,
  uniqueText: string | RegExp,
): Promise<void> {
  await waitFor(() => {
    expect(router.state.location.pathname).toBe(path);
  });
  await waitFor(() => {
    expect(screen.getByText(uniqueText)).toBeInTheDocument();
  });
}
