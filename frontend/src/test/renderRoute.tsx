import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/session";
import { UIStateProvider } from "../ui/UIStateProvider";
import { createAppRouter, setRouterRef } from "../router";
import { makeTestQueryClient } from "./queryClient";
import { makeFakeSupabase, makeSession, type FakeSupabaseHandle } from "./supabase-mock";
import { setSupabaseClientForTesting } from "../lib/supabase";

export interface RenderRouteOpts {
  /** Seed a Supabase session before mounting. Defaults to "signed-out". */
  session?: "signed-in" | "signed-out";
  /** Hook to configure the fake Supabase client before the tree renders
   *  (e.g. arm `nextExchangeError` so the callback route's first effect
   *  fails). Runs after `session` seeding. */
  configureFake?: (fake: FakeSupabaseHandle) => void;
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
  fake: FakeSupabaseHandle;
}

export function renderRoute(path: string, opts: RenderRouteOpts = {}): RenderRouteResult {
  const fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
  if (opts.session === "signed-in") fake.setSession(makeSession());
  opts.configureFake?.(fake);

  const queryClient = makeTestQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  // Register with the module-level router ref so 401s + signOut()
  // can navigate through the test's router (no-op if the test never
  // triggers either).
  setRouterRef(router);
  const dom = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UIStateProvider>
          <RouterProvider router={router} />
        </UIStateProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { router, dom, fake };
}

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
