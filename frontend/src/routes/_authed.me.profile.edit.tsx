import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { usePatchMe } from "../mutations/me";
import { meQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

function ProfileEditRoute() {
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQueryOptions());
  const patch = usePatchMe();
  const formUser = {
    id: me.display_id,
    email: me.email,
    name: me.name,
    zhName: me.zh_name ?? undefined,
    enName: me.en_name ?? undefined,
    nickname: me.nickname ?? undefined,
    phone: me.phone ?? undefined,
    phoneCode: me.phone_code ?? undefined,
    lineId: me.line_id ?? undefined,
    telegramId: me.telegram_id ?? undefined,
    country: me.country ?? undefined,
    location: me.location ?? undefined,
  };
  return (
    <ProfileSetupForm
      user={formUser}
      initial={formUser}
      title="編輯個人資料"
      subtitle="更新你的基本資訊"
      submitLabel="儲存變更"
      isSubmitting={patch.isPending}
      error={patch.error?.message ?? null}
      onCancel={() => navigate({ to: "/me/profile" })}
      onSubmit={async (profile) => {
        // ProfileCreate (all required) structurally satisfies ProfileUpdate
        // (all optional); the server treats a full overwrite as equivalent
        // to the current semantics the edit screen has always sent.
        try {
          await patch.mutateAsync(profile);
          navigate({ to: "/me/profile" });
        } catch {
          // error surfaces via patch.error; form stays mounted so the
          // user can retry without an unhandled-rejection warning.
        }
      }}
    />
  );
}

export const profileEditRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/me/profile/edit",
  beforeLoad: ({ location }) => {
    if (!location.state.fromProfile) {
      throw redirect({ to: "/me/profile" });
    }
  },
  component: ProfileEditRoute,
});
