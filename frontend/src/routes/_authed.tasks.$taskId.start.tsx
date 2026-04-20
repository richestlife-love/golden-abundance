import { createRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import InterestForm from "../screens/InterestForm";
import TicketForm from "../screens/TicketForm";
import TeamForm from "../screens/TeamForm";
import { useSubmitTask } from "../mutations/tasks";
import { useCreateJoinRequest } from "../mutations/teams";
import { authedRoute } from "./_authed";
import { myTasksQueryOptions } from "../queries/me";
import type { components } from "../api/schema";

type Task = components["schemas"]["Task"];

const SUPPORTED_TASK_DISPLAY_IDS = new Set(["T1", "T2", "T3"]);

function StartRoute() {
  const navigate = useNavigate();
  const { taskId } = taskStartRoute.useParams();
  const { data: tasks } = useSuspenseQuery(myTasksQueryOptions());
  const task = tasks.find((t: Task) => t.display_id === taskId);
  if (!task) throw notFound();
  const goDetail = () => navigate({ to: "/tasks/$taskId", params: { taskId: task.display_id } });
  const goMe = () => navigate({ to: "/me" });
  const submit = useSubmitTask();
  const join = useCreateJoinRequest();

  if (task.form_type === "interest") {
    return (
      <InterestForm
        onCancel={goDetail}
        isSubmitting={submit.isPending}
        onSubmit={async (body) => {
          try {
            await submit.mutateAsync({ id: task.id, body: { form_type: "interest", ...body } });
            goDetail();
          } catch {
            // error remains on submit.error; form stays open so user can retry
          }
        }}
      />
    );
  }
  if (task.form_type === "ticket") {
    return (
      <TicketForm
        onCancel={goDetail}
        isSubmitting={submit.isPending}
        onSubmit={async (body) => {
          try {
            await submit.mutateAsync({ id: task.id, body: { form_type: "ticket", ...body } });
            goDetail();
          } catch {
            // error remains on submit.error; form stays open so user can retry
          }
        }}
      />
    );
  }
  if (task.is_challenge) {
    return (
      <TeamForm
        onCancel={goMe}
        isSubmitting={join.isPending}
        onSubmit={async (teamId) => {
          try {
            await join.mutateAsync(teamId);
            goMe();
          } catch {
            // error remains on join.error; form stays open so user can retry
          }
        }}
      />
    );
  }
  throw notFound();
}

// Sibling of taskDetailRoute (not child): taskDetailRoute's component
// (TaskDetailScreen) has no <Outlet/>, so nesting would cause the start form
// to never render. Flatten so the router matches this leaf directly.
export const taskStartRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId/start",
  beforeLoad: ({ params }) => {
    if (!SUPPORTED_TASK_DISPLAY_IDS.has(params.taskId)) {
      throw notFound();
    }
  },
  component: StartRoute,
});
