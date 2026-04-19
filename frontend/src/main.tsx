import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { router } from "./router";

function AppShell() {
  const { user, profileComplete } = useAppState();
  // Re-evaluate route guards when auth state changes (e.g., sign-out mid-session).
  useEffect(() => {
    router.invalidate();
  }, [user, profileComplete]);
  return (
    <RouterProvider
      router={router}
      context={{ auth: { user: user ? { id: user.id } : null, profileComplete } }}
    />
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <AppStateProvider>
      <AppShell />
    </AppStateProvider>
  </StrictMode>,
);
