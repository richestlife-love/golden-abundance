import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import InterestForm from "../screens/InterestForm";
import TicketForm from "../screens/TicketForm";
import TeamForm from "../screens/TeamForm";
import { useAppState } from "../state/AppStateContext";
import { authedRoute } from "./_authed";

const SUPPORTED_TASK_IDS = new Set(["1", "2", "3"]);

function StartRoute() {
  const navigate = useNavigate();
  const { taskId } = taskStartRoute.useParams();
  const id = Number(taskId);
  const { completeTask, joinTeam } = useAppState();
  const goDetail = (forId: number) =>
    navigate({ to: "/tasks/$taskId", params: { taskId: String(forId) } });

  if (id === 1) {
    return (
      <InterestForm
        onCancel={() => goDetail(1)}
        onSubmit={() => {
          completeTask(1);
          goDetail(1);
        }}
      />
    );
  }
  if (id === 2) {
    return (
      <TicketForm
        onCancel={() => goDetail(2)}
        onSubmit={() => {
          completeTask(2);
          goDetail(2);
        }}
      />
    );
  }
  // id === 3 — guaranteed by beforeLoad's SUPPORTED_TASK_IDS check.
  return (
    <TeamForm
      onCancel={() => navigate({ to: "/me" })}
      onSubmit={(team) => {
        joinTeam(team);
        navigate({ to: "/me" });
      }}
    />
  );
}

// Sibling of taskDetailRoute (not child): taskDetailRoute's component
// (TaskDetailScreen) has no <Outlet/>, so nesting would cause the start form
// to never render. Flatten so the router matches this leaf directly.
export const taskStartRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/tasks/$taskId/start",
  beforeLoad: ({ location, params }) => {
    if (!SUPPORTED_TASK_IDS.has(params.taskId)) {
      throw redirect({ to: "/tasks/$taskId", params });
    }
    if (!location.state.fromDetail) {
      throw redirect({ to: "/tasks/$taskId", params });
    }
  },
  component: StartRoute,
});
