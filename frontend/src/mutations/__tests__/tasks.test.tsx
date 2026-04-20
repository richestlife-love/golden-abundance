// Behavior test for useSubmitTask's success overlay trigger. The
// default-invalidate map is covered in me.test.tsx; this file only
// asserts the pushSuccess fire/no-fire branch on reward presence.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { useSubmitTask } from "../tasks";
import * as ui from "../../ui/useUIState";
import * as f from "../../test/msw/fixtures";
import type { components } from "../../api/schema";

type Reward = components["schemas"]["Reward"];

function client(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSubmitTask", () => {
  it("fires pushSuccess when response includes a reward", async () => {
    const qc = client();
    const spy = vi.spyOn(ui, "pushSuccess");
    const task = f.tasksList[0]; // T1
    const reward: Reward = {
      id: "00000000-0000-0000-0000-000000000700",
      user_id: f.userJet.id,
      task_id: task.id,
      task_title: task.title,
      bonus: "limited badge",
      status: "earned",
      earned_at: "2026-04-20T00:00:00Z",
    };
    server.use(
      http.post(`/api/v1/tasks/${task.id}/submit`, () =>
        HttpResponse.json({ task: { ...task, status: "completed" }, reward }),
      ),
    );

    const { result } = renderHook(() => useSubmitTask(), { wrapper: wrap(qc) });

    result.current.mutate({
      id: task.id,
      body: {
        form_type: "interest",
        name: "Jet",
        phone: "0912",
        interests: ["nature"],
        availability: ["weekend"],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        color: task.color,
        points: task.points,
        bonus: "limited badge",
      }),
    );
  });

  it("does not fire pushSuccess when reward is null", async () => {
    const qc = client();
    const spy = vi.spyOn(ui, "pushSuccess");
    const task = f.tasksList[0];
    server.use(
      http.post(`/api/v1/tasks/${task.id}/submit`, () =>
        HttpResponse.json({ task: { ...task, status: "completed" }, reward: null }),
      ),
    );

    const { result } = renderHook(() => useSubmitTask(), { wrapper: wrap(qc) });

    result.current.mutate({
      id: task.id,
      body: {
        form_type: "interest",
        name: "Jet",
        phone: "0912",
        interests: ["x"],
        availability: ["y"],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });
});
