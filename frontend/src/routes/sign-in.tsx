import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import GoogleAuthScreen from "../screens/GoogleAuthScreen";
import { useAppState } from "../state/AppStateContext";
import { rootRoute } from "./__root";

function SignInRoute() {
  const navigate = useNavigate();
  const { handleSignIn } = useAppState();
  return (
    <GoogleAuthScreen
      onCancel={() => navigate({ to: "/" })}
      onSuccess={(raw) => {
        // After sign-in, the auth effect in main.tsx's AppShell (router.invalidate)
        // re-runs the guard on /sign-in, which redirects to /welcome (incomplete
        // profile) or /home (complete). No explicit navigate needed — and doing
        // both would race.
        handleSignIn(raw);
      }}
    />
  );
}

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      throw redirect({ to: context.auth.profileComplete ? ("/home" as never) : "/welcome" });
    }
  },
  component: SignInRoute,
});
