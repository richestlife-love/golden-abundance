import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectScreen, renderRoute } from "../../test/renderRoute";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";

function useIncompleteUser(): void {
  server.use(http.get("/api/v1/me", () => HttpResponse.json(f.userIncomplete)));
}

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
    // GoogleAuthScreen.tsx:98 renders "使用 Google 帳號登入" (Traditional — present in source).
    await waitFor(() => {
      expect(screen.getByText("使用 Google 帳號登入")).toBeInTheDocument();
    });
  });

  it("guest visiting /welcome is redirected to /sign-in", async () => {
    const { router } = renderRoute("/welcome");
    await expectScreen(router, "/sign-in", "使用 Google 帳號登入");
  });
});

describe("authed simple routes", () => {
  it("renders home at /home when authed + complete", async () => {
    renderRoute("/home", { session: "signed-in" });
    // BottomNav renders "首頁" (Traditional) — match exactly.
    await waitFor(() => {
      expect(screen.getByText("首頁")).toBeInTheDocument();
    });
  });

  it("redirects guest /home to /sign-in", async () => {
    const { router } = renderRoute("/home");
    await expectScreen(router, "/sign-in", "使用 Google 帳號登入");
  });

  it("redirects authed-incomplete /home to /welcome", async () => {
    useIncompleteUser();
    const { router } = renderRoute("/home", { session: "signed-in" });
    await expectScreen(router, "/welcome", "完善個人資料");
  });
});

describe("me routes", () => {
  it("renders my screen at /me", async () => {
    renderRoute("/me", { session: "signed-in" });
    await waitFor(() => {
      // MyScreen title and BottomNav both render "我的" (Traditional).
      expect(screen.getAllByText("我的").length).toBeGreaterThan(0);
    });
  });

  it("renders profile view at /me/profile", async () => {
    renderRoute("/me/profile", { session: "signed-in" });
    // ProfileScreen.tsx renders "編輯" (Traditional) in the edit button.
    await waitFor(() => {
      expect(screen.queryByText(/編輯/)).not.toBeNull();
    });
  });

  it("cold-load /me/profile/edit redirects to /me/profile", async () => {
    const { router } = renderRoute("/me/profile/edit", { session: "signed-in" });
    await expectScreen(router, "/me/profile", /編輯/);
  });
});

describe("task routes", () => {
  it("renders task detail at /tasks/T3", async () => {
    const { router } = renderRoute("/tasks/T3", { session: "signed-in" });
    // T3 title is "組隊挑戰" (Traditional — present in fixtures).
    await expectScreen(router, "/tasks/T3", "組隊挑戰");
  });

  it("direct-nav to /tasks/T2/start renders TicketForm", async () => {
    const { router } = renderRoute("/tasks/T2/start", { session: "signed-in" });
    await expectScreen(router, "/tasks/T2/start", "7/25 票券編號");
    expect(screen.queryByText("任務說明")).toBeNull();
  });
});

describe("landing CTA", () => {
  it("guest → /sign-in", async () => {
    // Guest sees the landing page; clicking the CTA navigates to /sign-in.
    const { router } = renderRoute("/");
    await waitFor(() => expect(screen.getByText("金富有志工")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /開啟/ }));
    await expectScreen(router, "/sign-in", "使用 Google 帳號登入");
  });

  it("authed + complete visiting / → /home (auto redirect)", async () => {
    // Index guard redirects authed+complete users away from the landing page.
    const { router } = renderRoute("/", { session: "signed-in" });
    await expectScreen(router, "/home", "首頁");
  });

  it("authed + incomplete visiting / → /welcome (auto redirect)", async () => {
    useIncompleteUser();
    const { router } = renderRoute("/", { session: "signed-in" });
    await expectScreen(router, "/welcome", "完善個人資料");
  });
});

describe("guard sweep", () => {
  it("authed complete visiting /sign-in → /home", async () => {
    const { router } = renderRoute("/sign-in", { session: "signed-in" });
    await expectScreen(router, "/home", "首頁");
  });

  it("authed complete visiting /welcome → /home", async () => {
    const { router } = renderRoute("/welcome", { session: "signed-in" });
    await expectScreen(router, "/home", "首頁");
  });

  it("authed incomplete visiting /sign-in → /welcome", async () => {
    useIncompleteUser();
    const { router } = renderRoute("/sign-in", { session: "signed-in" });
    await expectScreen(router, "/welcome", "完善個人資料");
  });

  it("signing out while on /home redirects to /sign-in", async () => {
    const { router } = renderRoute("/home", { session: "signed-in" });
    await expectScreen(router, "/home", "首頁");
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("登出"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/sign-in"));
  });
});

describe("not found", () => {
  it("/tasks/999 routes to the root not-found (beforeLoad throws notFound)", async () => {
    // taskDetailRoute's beforeLoad throws notFound() for unknown display IDs so the
    // root __root notFoundComponent renders — one consistent 404 UX.
    renderRoute("/tasks/999", { session: "signed-in" });
    await waitFor(() => {
      expect(screen.getByText("找不到頁面")).toBeInTheDocument();
    });
  });

  it("a truly unmatched route also renders the root not-found component", async () => {
    renderRoute("/does-not-exist-at-all", { session: "signed-in" });
    await waitFor(() => {
      expect(screen.getByText("找不到頁面")).toBeInTheDocument();
    });
  });
});

describe("click-through: start task", () => {
  it("/tasks/T2 → '繼續任務' button → /tasks/T2/start renders TicketForm", async () => {
    // Task T2 is in_progress; its CTA is "繼續任務" (Traditional — matches source).
    // "夏季盛會報名" is BOTH task 2's title AND TicketForm's title, so we
    // assert on strings unique to TicketForm: the label "7/25 票券編號".
    // We also assert TaskDetailScreen's unique "任務說明" is gone — that catches
    // the case where the route's parent keeps rendering over the child (no Outlet).
    const { router } = renderRoute("/tasks/T2", { session: "signed-in" });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/T2");
    });
    // TaskDetailScreen renders 任務說明 section — grounding check.
    expect(screen.getByText("任務說明")).toBeInTheDocument();
    const startBtn = await screen.findByRole("button", { name: /繼續任務/ });
    await userEvent.click(startBtn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/tasks/T2/start");
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
  it("back() from /tasks/T1 re-renders /tasks (not just URL — DOM-level check)", async () => {
    const { router } = renderRoute("/tasks", { session: "signed-in" });
    await expectScreen(router, "/tasks", /個進行中/);
    await router.navigate({ to: "/tasks/$taskId", params: { taskId: "T1" } });
    // "任務說明" is unique to TaskDetailScreen — proves the detail view mounted.
    await expectScreen(router, "/tasks/T1", "任務說明");
    router.history.back();
    // After back, tasks list is visible and detail-only content is gone.
    await expectScreen(router, "/tasks", /個進行中/);
    expect(screen.queryByText("任務說明")).toBeNull();
  });
});
