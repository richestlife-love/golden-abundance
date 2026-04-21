import {
  createRouter,
  createBrowserHistory,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { authedRoute } from "./routes/_authed";
import { signInRoute } from "./routes/sign-in";
import { authCallbackRoute } from "./routes/auth.callback";
import { welcomeRoute } from "./routes/welcome";
import { homeRoute } from "./routes/_authed.home";
import { leaderboardRoute } from "./routes/_authed.leaderboard";
import { rewardsRoute } from "./routes/_authed.rewards";
import { tasksRoute } from "./routes/_authed.tasks";
import { taskDetailRoute } from "./routes/_authed.tasks.$taskId";
import { taskStartRoute } from "./routes/_authed.tasks.$taskId.start";
import { meRoute } from "./routes/_authed.me";
import { profileRoute } from "./routes/_authed.me.profile";
import { profileEditRoute } from "./routes/_authed.me.profile.edit";

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  authCallbackRoute,
  welcomeRoute,
  authedRoute.addChildren([
    homeRoute,
    tasksRoute,
    taskDetailRoute,
    taskStartRoute,
    leaderboardRoute,
    meRoute,
    profileRoute,
    profileEditRoute,
    rewardsRoute,
  ]),
]);

export function createAppRouter(opts: { queryClient: QueryClient; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history: opts.history ?? createBrowserHistory(),
    defaultPreload: "intent",
    context: { queryClient: opts.queryClient },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
  interface HistoryState {
    fromDetail?: boolean;
    fromProfile?: boolean;
  }
}

export type AppRouter = AnyRouter;

// Module-level router holder — mirrors `_setActiveQueryClient` in auth/session
// so the 401 interceptor / module-level signOut can `router.navigate(...)`
// without a React context. `main.tsx` wires the singleton; tests that stand
// up their own router via `renderRoute` skip this (navigation is a no-op in
// that case, which is fine because the test router isn't mounted here).
let routerRef: ReturnType<typeof createAppRouter> | null = null;
export function setRouterRef(r: ReturnType<typeof createAppRouter> | null): void {
  routerRef = r;
}
export function getRouterRef(): ReturnType<typeof createAppRouter> | null {
  return routerRef;
}
