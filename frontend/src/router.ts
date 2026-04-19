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

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  welcomeRoute,
  authedRoute.addChildren([]),
]);

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
