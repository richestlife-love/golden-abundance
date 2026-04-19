import { createRoute, notFound } from "@tanstack/react-router";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import { TASKS } from "../data";
import { authedRoute } from "./_authed";

function TaskDetailRouteComponent() {
  const { taskId } = taskDetailRoute.useParams();
  return <TaskDetailScreen taskId={taskId} />;
}

export const taskDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId",
  beforeLoad: ({ params }) => {
    if (!TASKS.some((t) => t.id === Number(params.taskId))) {
      throw notFound();
    }
  },
  component: TaskDetailRouteComponent,
});
