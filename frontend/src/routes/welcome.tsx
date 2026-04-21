import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useCompleteProfile } from "../mutations/me";
import { useAuth } from "../auth/session";
import { getSupabaseClient } from "../lib/supabase";
import { meQueryOptions } from "../queries/me";
import { rootRoute } from "./__root";

function WelcomeRoute() {
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQueryOptions());
  const { signOut } = useAuth();
  const complete = useCompleteProfile();
  // Adapter: ProfileSetupForm reads camelCase for avatar/email display;
  // the submit path emits snake_case ProfileCreate directly.
  const formUser = { id: me.display_id, email: me.email, name: me.name };
  return (
    <ProfileSetupForm
      user={formUser}
      isSubmitting={complete.isPending}
      error={complete.error?.message ?? null}
      onCancel={() => {
        void signOut();
      }}
      onSubmit={async (profile) => {
        try {
          await complete.mutateAsync(profile);
          navigate({ to: "/home" });
        } catch {
          // error surfaces via complete.error; form stays mounted so the
          // user can retry without an unhandled-rejection warning.
        }
      }}
    />
  );
}

export const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  beforeLoad: async ({ context, location }) => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/sign-in",
        search: { returnTo: location.href },
      });
    }
    const me = await context.queryClient.ensureQueryData(meQueryOptions());
    if (me.profile_complete) throw redirect({ to: "/home" });
  },
  component: WelcomeRoute,
});
