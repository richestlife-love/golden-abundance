import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function WelcomeRoute() {
  const navigate = useNavigate();
  const { user, handleProfileComplete, handleSignOut } = useAppState();
  return (
    <ProfileSetupForm
      user={user}
      onCancel={() => {
        handleSignOut();
        navigate({ to: "/" });
      }}
      onSubmit={(profile) => {
        handleProfileComplete(profile);
        navigate({ to: "/home" as never });
      }}
    />
  );
}

export const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: "/sign-in" });
    if (context.auth.profileComplete) throw redirect({ to: "/home" as never });
  },
  component: WelcomeRoute,
});
