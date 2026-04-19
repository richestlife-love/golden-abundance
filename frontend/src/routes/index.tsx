import { createRoute, useNavigate } from "@tanstack/react-router";
import LandingScreen from "../screens/LandingScreen";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function LandingRoute() {
  const navigate = useNavigate();
  const { user, profileComplete } = useAppState();
  const handleStart = () => {
    // /home is added in Task 6; cast until then.
    if (!user) navigate({ to: "/sign-in" });
    else if (!profileComplete) navigate({ to: "/welcome" });
    else navigate({ to: "/home" as never });
  };
  return <LandingScreen onStart={handleStart} />;
}

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingRoute,
});
