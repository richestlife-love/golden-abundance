import { createRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import { authedRoute } from "./_authed";
import { myTasksQueryOptions } from "../queries/me";
import { taskQueryOptions } from "../queries/tasks";
import { qk } from "../queries/keys";
import type { components } from "../api/schema";

type Task = components["schemas"]["Task"];

function TaskDetailRouteComponent() {
  const { taskId: displayId } = taskDetailRoute.useParams();
  const myTasks = useSuspenseQuery(myTasksQueryOptions());
  const summary = myTasks.data.find((t: Task) => t.display_id === displayId);
  if (!summary) throw notFound(); // belt-and-braces; loader already checked
  const { data: task } = useSuspenseQuery(taskQueryOptions(summary.id));
  return <TaskDetailScreen task={task} myTasks={myTasks.data} />;
}

export const taskDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId",
  loader: async ({ params, context }) => {
    // Child loaders run in parallel with the parent's loader, so ensure
    // myTasks here before reading it to resolve the task id.
    await context.queryClient.ensureQueryData(myTasksQueryOptions());
    const list = context.queryClient.getQueryData<Task[]>(qk.myTasks) ?? [];
    const task = list.find((t) => t.display_id === params.taskId);
    if (!task) throw notFound();
    await context.queryClient.ensureQueryData(taskQueryOptions(task.id));
  },
  component: TaskDetailRouteComponent,
});
