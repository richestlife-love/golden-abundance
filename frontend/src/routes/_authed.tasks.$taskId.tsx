import { createRoute } from "@tanstack/react-router";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import { authedRoute } from "./_authed";

export const taskDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId",
  component: TaskDetailScreen,
});
