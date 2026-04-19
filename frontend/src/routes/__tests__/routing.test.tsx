import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { expectScreen, renderRoute } from "../../test/renderRoute";

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
    await expectScreen(router, "/sign-in", "選擇帳號");
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
    await expectScreen(router, "/", "金富有志工");
  });

  it("redirects authed-incomplete /home to /welcome", async () => {
    const { router } = renderRoute("/home", { seed: "authed-incomplete" });
    await expectScreen(router, "/welcome", "完善個人資料");
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
    await expectScreen(router, "/me/profile", /編輯/);
  });
});

describe("task routes", () => {
  it("renders task detail at /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3", { seed: "authed-complete" });
    // TASKS[2].title is "組隊挑戰" (Traditional — present in data.ts).
    await expectScreen(router, "/tasks/3", "組隊挑戰");
  });

  it("redirects /tasks/3/start on cold load to /tasks/3", async () => {
    const { router } = renderRoute("/tasks/3/start", { seed: "authed-complete" });
    await expectScreen(router, "/tasks/3", "組隊挑戰");
  });

  it("direct-nav to /tasks/2/start with fromDetail state renders TicketForm", async () => {
    // Regression for the "nested-route with no <Outlet/> on parent" bug.
    // Starting on /tasks/2 gets the sentinel; navigating to /start must render
    // the form (and NOT the detail screen on top of it).
    const { router } = renderRoute("/tasks/2", { seed: "authed-complete" });
    await expectScreen(router, "/tasks/2", "夏季盛會報名");
    await router.navigate({
      to: "/tasks/$taskId/start",
      params: { taskId: "2" },
      state: { fromDetail: true },
    });
    await expectScreen(router, "/tasks/2/start", "7/25 票券編號");
    expect(screen.queryByText("任務說明")).toBeNull();
  });
});

describe("landing CTA", () => {
  it("guest → /sign-in", async () => {
    const { router } = renderRoute("/");
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await expectScreen(router, "/sign-in", "選擇帳號");
  });

  it("authed + complete → /home", async () => {
    const { router } = renderRoute("/", { seed: "authed-complete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await expectScreen(router, "/home", "首页");
  });

  it("authed + incomplete → /welcome", async () => {
    const { router } = renderRoute("/", { seed: "authed-incomplete" });
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /开启/ }));
    await expectScreen(router, "/welcome", "完善個人資料");
  });
});

describe("guard sweep", () => {
  it("authed complete visiting /sign-in → /home", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-complete" });
    await expectScreen(router, "/home", "首页");
  });

  it("authed complete visiting /welcome → /home", async () => {
    const { router } = renderRoute("/welcome", { seed: "authed-complete" });
    await expectScreen(router, "/home", "首页");
  });

  it("authed incomplete visiting /sign-in → /welcome", async () => {
    const { router } = renderRoute("/sign-in", { seed: "authed-incomplete" });
    await expectScreen(router, "/welcome", "完善個人資料");
  });

  it("signing out while on /home redirects to /", async () => {
    // Guard defense-in-depth: even without an explicit navigate,
    // handleSignOut → AppShell's router.invalidate() re-evaluates
    // _authed's beforeLoad, which redirects guest → /.
    const { router, getState } = renderRoute("/home", { seed: "authed-complete" });
    await expectScreen(router, "/home", "首页");
    await act(async () => {
      getState().handleSignOut();
    });
    await expectScreen(router, "/", "金富有志工");
  });
});

describe("not found", () => {
  it("/tasks/999 routes to the root not-found (beforeLoad throws notFound)", async () => {
    // taskDetailRoute's beforeLoad throws notFound() for unknown IDs so the
    // root __root notFoundComponent renders — one consistent 404 UX.
    renderRoute("/tasks/999", { seed: "authed-complete" });
    await waitFor(() => {
      expect(screen.getByText("找不到页面")).toBeInTheDocument();
    });
  });

  it("a truly unmatched route also renders the root not-found component", async () => {
    renderRoute("/does-not-exist-at-all", { seed: "authed-complete" });
    await waitFor(() => {
      expect(screen.getByText("找不到页面")).toBeInTheDocument();
    });
  });
});

describe("click-through: start task", () => {
  it("/tasks/2 → '繼續任務' button → /tasks/2/start renders TicketForm (not TaskDetailScreen)", async () => {
    // Task 2 is in_progress; its CTA is "繼續任務" (Traditional — matches source).
    // Task 3 is the team task whose CTA routes to /me, not /tasks/3/start.
    // Note: "夏季盛會報名" is BOTH task 2's title AND TicketForm's title, so we
    // assert on strings unique to TicketForm: the label "7/25 票券編號".
    // We also assert TaskDetailScreen's unique "任務說明" is gone — that catches
    // the case where the route's parent keeps rendering over the child (no Outlet).
    const { router } = renderRoute("/tasks/2", { seed: "authed-complete" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/2");
    });
    // TaskDetailScreen renders 任務說明 section — grounding check.
    expect(screen.getByText("任務說明")).toBeInTheDocument();
    const startBtn = await screen.findByRole("button", { name: /繼續任務/ });
    await userEvent.click(startBtn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/2/start");
    });
    // Assert the form rendered (TicketForm-unique string).
    await waitFor(() => {
      expect(screen.getByText("7/25 票券編號")).toBeInTheDocument();
    });
    // And TaskDetailScreen is gone — this is what catches the "no Outlet on parent" bug.
    expect(screen.queryByText("任務說明")).toBeNull();
  });
});

describe("history back", () => {
  it("back() from /tasks/1 re-renders /tasks (not just URL — DOM-level check)", async () => {
    const { router } = renderRoute("/home", { seed: "authed-complete" });
    await expectScreen(router, "/home", "首页");
    await router.navigate({ to: "/tasks" });
    await expectScreen(router, "/tasks", "任务");
    await router.navigate({ to: "/tasks/$taskId", params: { taskId: "1" } });
    // "任務說明" is unique to TaskDetailScreen — proves the detail view mounted.
    await expectScreen(router, "/tasks/1", "任務說明");
    router.history.back();
    // After back, tasks list is visible and detail-only content is gone.
    await expectScreen(router, "/tasks", "任务");
    expect(screen.queryByText("任務說明")).toBeNull();
  });
});
