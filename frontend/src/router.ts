import {
  createRouter,
  createBrowserHistory,
  type AnyRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { rootRoute, type RouterContext } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { authedRoute } from "./routes/_authed";
import { signInRoute } from "./routes/sign-in";
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

/**
 * Creates the app router.
 *
 * `initialContext` exists for tests: they need the first-render guard to see
 * the correct auth state *before* AppShell hoists it via RouterProvider's
 * `context` prop. In prod, main.tsx uses the hardcoded guest default here and
 * hoists the real auth via RouterProvider, which is always correct since the
 * initial real-app auth is also guest.
 */
export function createAppRouter(opts?: {
  history?: RouterHistory;
  initialContext?: RouterContext;
}) {
  return createRouter({
    routeTree,
    history: opts?.history ?? createBrowserHistory(),
    defaultPreload: "intent",
    context: opts?.initialContext ?? {
      auth: { user: null, profileComplete: false },
    },
  });
}

export const router = createAppRouter();

// Typed history state — lets us use `state: { fromDetail: true }` without `as never`.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface HistoryState {
    fromDetail?: boolean;
    fromProfile?: boolean;
  }
}

export type AppRouter = AnyRouter;
