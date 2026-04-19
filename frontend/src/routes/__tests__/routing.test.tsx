import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderRoute } from "../../test/renderRoute";

describe("router scaffolding", () => {
  it("renders the landing screen at /", async () => {
    renderRoute("/");
    await waitFor(() => {
      expect(screen.getByText("金富有志工")).toBeInTheDocument();
    });
  });
});

describe("_authed layout", () => {
  it("is defined with the expected id", async () => {
    const { authedRoute } = await import("../_authed");
    expect(authedRoute.id).toContain("_authed");
  });
});

describe("public routes", () => {
  it("renders sign-in at /sign-in", async () => {
    renderRoute("/sign-in");
    // GoogleAuthScreen.tsx:98 renders "選擇帳號" (Traditional — present in source).
    await waitFor(() => {
      expect(screen.getByText("選擇帳號")).toBeInTheDocument();
    });
  });

  it("guest visiting /welcome is redirected to /sign-in", async () => {
    const { router } = renderRoute("/welcome");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/sign-in");
    });
  });
});

describe("authed simple routes", () => {
  it("renders home at /home when authed + complete", async () => {
    renderRoute("/home", { seed: "authed-complete" });
    // BottomNav.tsx:55 renders "首页" (Simplified) — match exactly.
    await waitFor(() => {
      expect(screen.getByText("首页")).toBeInTheDocument();
    });
  });

  it("redirects guest /home to /", async () => {
    const { router } = renderRoute("/home");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });

  it("redirects authed-incomplete /home to /welcome", async () => {
    const { router } = renderRoute("/home", { seed: "authed-incomplete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/welcome");
    });
  });
});

describe("me routes", () => {
  it("renders my screen at /me", async () => {
    renderRoute("/me", { seed: "authed-complete" });
    await waitFor(() => {
      // MyScreen title and BottomNav both render "我的" (Traditional).
      expect(screen.getAllByText("我的").length).toBeGreaterThan(0);
    });
  });

  it("renders profile view at /me/profile", async () => {
    renderRoute("/me/profile", { seed: "authed-complete" });
    // ProfileScreen.tsx renders "編輯" (Traditional) in the edit button.
    await waitFor(() => {
      expect(screen.queryByText(/編輯/)).not.toBeNull();
    });
  });

  it("cold-load /me/profile/edit redirects to /me/profile", async () => {
    const { router } = renderRoute("/me/profile/edit", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/me/profile");
    });
  });
});

describe("task routes", () => {
  it("renders task detail at /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3");
    });
    // TASKS[2].title is "組隊挑戰" (Traditional — present in data.ts).
    await waitFor(() => {
      expect(screen.getByText("組隊挑戰")).toBeInTheDocument();
    });
  });

  it("redirects /tasks/3/start on cold load to /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3/start", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/3");
    });
  });
});

describe("landing CTA", () => {
  it("guest → /sign-in", async () => {
    const { router } = renderRoute("/");
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sign-in"));
  });

  it("authed + complete → /home", async () => {
    const { router } = renderRoute("/", { seed: "authed-complete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed + incomplete → /welcome", async () => {
    const { router } = renderRoute("/", { seed: "authed-incomplete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  });
});

describe("guard sweep", () => {
  it("authed complete visiting /sign-in → /home", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed complete visiting /welcome → /home", async () => {
    const { router } = renderRoute("/welcome", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
  });

  it("authed incomplete visiting /sign-in → /welcome", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-incomplete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/welcome"));
  });
});

describe("not found", () => {
  it("/tasks/999 renders TaskDetailScreen's not-found state", async () => {
    // /tasks/$taskId matches any taskId — TaskDetailScreen handles the null-task
    // case itself and renders "找不到任務" rather than delegating to __root notFoundComponent.
    renderRoute("/tasks/999", { seed: "authed-complete" });
    await waitFor(() => {
      expect(screen.getByText("找不到任務")).toBeInTheDocument();
    });
  });

  it("a truly unmatched route renders the root not-found component", async () => {
    renderRoute("/does-not-exist-at-all", { seed: "authed-complete" });
    await waitFor(() => {
      expect(screen.getByText("找不到页面")).toBeInTheDocument();
    });
  });
});

describe("click-through: start task", () => {
  it("/tasks/2 → '繼續任務' button → /tasks/2/start", async () => {
    // Task 2 is in_progress; its CTA is "繼續任務" (Traditional — matches source).
    // Task 3 is the team task whose CTA routes to /me, not /tasks/3/start.
    const { router } = renderRoute("/tasks/2", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/2");
    });
    const startBtn = await screen.findByRole("button", { name: /繼續任務/ });
    await userEvent.click(startBtn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/2/start");
    });
  });
});

describe("history back", () => {
  it("memory history supports back() across /home → /tasks → /tasks/1 → back → /tasks", async () => {
    const { router } = renderRoute("/home", { seed: "authed-complete" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
    await router.navigate({ to: "/tasks" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
    await router.navigate({ to: "/tasks/$taskId", params: { taskId: "1" } });
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks/1"));
    router.history.back();
    await waitFor(() => expect(router.state.location.pathname).toBe("/tasks"));
  });
});
