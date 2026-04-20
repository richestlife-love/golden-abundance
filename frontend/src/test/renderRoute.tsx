import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/session";
import { UIStateProvider } from "../ui/UIStateProvider";
import { AppStateProvider } from "../state/AppStateContext";
import { tokenStore } from "../auth/token";
import { createAppRouter } from "../router";
import { makeTestQueryClient } from "./queryClient";

export interface RenderRouteOpts {
  /** Pre-seed the bearer token. Test handlers will see "Authorization: Bearer <token>". */
  token?: string;
}

export interface RenderRouteResult {
  router: ReturnType<typeof createAppRouter>;
  dom: ReturnType<typeof render>;
}

export function renderRoute(path: string, opts: RenderRouteOpts = {}): RenderRouteResult {
  if (opts.token) tokenStore.set(opts.token);
  const queryClient = makeTestQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const dom = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <UIStateProvider>
            <RouterProvider router={router} />
          </UIStateProvider>
        </AppStateProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { router, dom };
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
