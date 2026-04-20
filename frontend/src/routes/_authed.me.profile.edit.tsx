import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import ProfileSetupForm from "../screens/ProfileSetupForm";
import { useAppState } from "../state/AppStateContext";
import { meQueryOptions } from "../queries/me";
import { authedRoute } from "./_authed";

function ProfileEditRoute() {
  const navigate = useNavigate();
  const { data: me } = useSuspenseQuery(meQueryOptions());
  const { handleProfileUpdate } = useAppState();
  // Adapter: ProfileSetupForm still reads legacy camelCase. Migration to
  // snake_case + usePatchMe lands in plan 4c alongside the form rewrite.
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
      onCancel={() => navigate({ to: "/me/profile" })}
      onSubmit={(profile) => {
        handleProfileUpdate(profile);
        navigate({ to: "/me/profile" });
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
