import { createRoute } from "@tanstack/react-router";
import TasksScreen from "../screens/TasksScreen";
import { authedRoute } from "./_authed";

// myTasks is ensured by the parent authedRoute loader.
export const tasksRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks",
  component: TasksScreen,
});
