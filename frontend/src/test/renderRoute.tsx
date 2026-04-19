import { useEffect } from "react";
import { render } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { AppStateProvider, useAppState } from "../state/AppStateContext";
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

function Shell({ router }: { router: ReturnType<typeof createAppRouter> }) {
  const { user, profileComplete } = useAppState();
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
  const dom = render(
    <AppStateProvider initialUser={userForSeed(seed)}>
      <Shell router={router} />
    </AppStateProvider>,
  );
  return { router, dom };
}
