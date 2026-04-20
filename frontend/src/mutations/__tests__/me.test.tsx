import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { useCompleteProfile } from "../me";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";
import type { ReactNode } from "react";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useCompleteProfile", () => {
  it("invalidates qk.me, qk.myTeams, qk.myTasks on success", async () => {
    server.use(
      http.post("/api/v1/me/profile", () =>
        HttpResponse.json({ user: f.userJet, led_team: f.teamJetLed }),
      ),
    );
    const qc = makeClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCompleteProfile(), {
      wrapper: wrapper(qc),
    });

    result.current.mutate({
      zh_name: "金杰",
      phone: "0912",
      phone_code: "+886",
      country: "TW",
      location: "台北",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = spy.mock.calls.map(
      ([opts]) => (opts as { queryKey: unknown }).queryKey,
    );
    expect(calledKeys).toEqual(
      expect.arrayContaining([qk.me, qk.myTeams, qk.myTasks]),
    );
  });
});
