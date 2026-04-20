import { createRoute } from "@tanstack/react-router";
import TasksScreen from "../screens/TasksScreen";
import { myTasksQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

export const tasksRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks",
  loader: ({ context }) => context.queryClient.ensureQueryData(myTasksQueryOptions()),
  component: TasksScreen,
});
