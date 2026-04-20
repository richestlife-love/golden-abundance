// Behavior tests for the three optimistic team-mutation hooks
// (approve, reject, patch). The default-invalidate assertions for all
// mutations live in `me.test.tsx`; this file only covers the optimistic
// patch + rollback behavior that the onSettled map can't reach.

import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import {
  useApproveJoinRequest,
  useRejectJoinRequest,
  usePatchTeam,
} from "../teams";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";
import type { components } from "../../api/schema";

type MeTeamsResponse = components["schemas"]["MeTeamsResponse"];
type Team = components["schemas"]["Team"];
type JoinRequest = components["schemas"]["JoinRequest"];

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function teamWithRequest(): Team {
  const req: JoinRequest = {
    id: "00000000-0000-0000-0000-000000000900",
    team_id: f.teamJetLed.id,
    user: {
      id: "00000000-0000-0000-0000-000000000801",
      display_id: "UALEX",
      name: "陳志豪",
      avatar_url: null,
    },
    status: "pending",
    requested_at: "2026-04-20T00:00:00Z",
  };
  return { ...f.teamJetLed, requests: [req], members: [] };
}

describe("useApproveJoinRequest (optimistic)", () => {
  it("patches qk.myTeams.led before the network responds", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    let release: () => void = () => {};
    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/approve`,
        () =>
          new Promise<Response>((res) => {
            release = () =>
              res(
                HttpResponse.json({
                  ...team,
                  requests: [],
                  members: [team.requests![0].user],
                }),
              );
          }),
      ),
    );

    const { result } = renderHook(() => useApproveJoinRequest(), {
      wrapper: wrap(qc),
    });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => {
      const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      expect(after?.led?.members).toHaveLength(1);
      expect(after?.led?.requests).toHaveLength(0);
    });

    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back on error", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    const before: MeTeamsResponse = { led: team, joined: null };
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, before);

    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/approve`,
        () => HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useApproveJoinRequest(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<MeTeamsResponse>(qk.myTeams)).toEqual(before);
  });
});

describe("useRejectJoinRequest (optimistic)", () => {
  it("removes the request from led without adding a member", async () => {
    const qc = makeClient();
    const team = teamWithRequest();
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    server.use(
      http.post(
        `/api/v1/teams/${team.id}/join-requests/${team.requests![0].id}/reject`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => useRejectJoinRequest(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, reqId: team.requests![0].id });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
    expect(after?.led?.requests).toHaveLength(0);
    expect(after?.led?.members).toHaveLength(0);
  });
});

describe("usePatchTeam (optimistic alias/topic swap)", () => {
  it("patches alias on led immediately", async () => {
    const qc = makeClient();
    const team: Team = { ...f.teamJetLed, alias: null };
    qc.setQueryData<MeTeamsResponse>(qk.myTeams, { led: team, joined: null });

    server.use(
      http.patch(`/api/v1/teams/${team.id}`, () =>
        HttpResponse.json({ ...team, alias: "夢想隊" }),
      ),
    );

    const { result } = renderHook(() => usePatchTeam(), { wrapper: wrap(qc) });
    result.current.mutate({ teamId: team.id, body: { alias: "夢想隊" } });

    await waitFor(() => {
      const after = qc.getQueryData<MeTeamsResponse>(qk.myTeams);
      expect(after?.led?.alias).toBe("夢想隊");
    });
  });
});
