import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { AppStateProvider } from "./state/AppStateContext";
import { AuthProvider } from "./auth/session";
import { UIStateProvider } from "./ui/UIStateProvider";
import { queryClient } from "./queryClient";
import { createAppRouter, setRouterRef } from "./router";

const router = createAppRouter({ queryClient });
setRouterRef(router);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <UIStateProvider>
            <RouterProvider router={router} />
          </UIStateProvider>
        </AppStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
