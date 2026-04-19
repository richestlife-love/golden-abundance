import { createRoute } from "@tanstack/react-router";
import ProfileScreen from "../screens/ProfileScreen";
import { authedRoute } from "./_authed";

export const profileRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/me/profile",
  component: ProfileScreen,
});
