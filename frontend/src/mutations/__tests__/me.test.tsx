// Table-driven regression guard: every default-invalidate mutation in
// `mutations/*.ts` fires the spec §6.1 key set on success. Spec wants
// this as a table; the hooks inline their `onSuccess` invalidations, so
// this test is what catches a hook that forgets a key.
//
// 4c adds optimistic patches for three of these (approve/reject/patch
// team) — those get their own behavior tests in mutations/__tests__/
// teams.test.ts. This file only asserts the default-invalidate map.

import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider, type UseMutationResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { server } from "../../test/msw/server";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";

import { useCompleteProfile, usePatchMe } from "../me";
import { useSubmitTask } from "../tasks";
import {
  useApproveJoinRequest,
  useCancelJoinRequest,
  useCreateJoinRequest,
  useLeaveTeam,
  usePatchTeam,
  useRejectJoinRequest,
} from "../teams";

const teamId = "00000000-0000-0000-0000-000000000010";
const reqId = "00000000-0000-0000-0000-000000000020";
const taskId = "00000000-0000-0000-0000-000000000101";

const joinRequestRow = {
  id: reqId,
  team_id: teamId,
  requester: {
    id: f.userJet.id,
    display_id: f.userJet.display_id,
    name: f.userJet.name,
    avatar_url: null,
  },
  status: "pending" as const,
  created_at: "2026-04-20T00:00:00Z",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyHook = () => UseMutationResult<any, Error, any, any>;

interface Case {
  name: string;
  useHook: AnyHook;
  handler: Parameters<typeof server.use>[0];
  args: unknown;
  expectedKeys: readonly unknown[];
}

const cases: Case[] = [
  {
    name: "useCompleteProfile",
    useHook: useCompleteProfile,
    handler: http.post("/api/v1/me/profile", () =>
      HttpResponse.json({ user: f.userJet, led_team: f.teamJetLed }),
    ),
    args: {
      zh_name: "金杰",
      phone: "0912",
      phone_code: "+886",
      country: "TW",
      location: "台北",
    },
    // qk.me prefix (["me"]) already matches qk.myTasks / qk.myTeams /
    // qk.myRewards, so invalidating qk.me alone covers them.
    expectedKeys: [qk.me],
  },
  {
    name: "usePatchMe",
    useHook: usePatchMe,
    handler: http.patch("/api/v1/me", () => HttpResponse.json(f.userJet)),
    args: { zh_name: "金杰 v2" },
    // qk.me covers myTeams via prefix; qk.teamsAll is a separate namespace
    // (team search cache) that a profile edit may invalidate (e.g. alias).
    expectedKeys: [qk.me, qk.teamsAll],
  },
  {
    name: "useSubmitTask",
    useHook: useSubmitTask,
    handler: http.post(`/api/v1/tasks/${taskId}/submit`, () =>
      HttpResponse.json({ task: f.tasksList[0], reward: null }),
    ),
    args: {
      id: taskId,
      body: {
        form_type: "interest",
        name: "jet",
        phone: "0912",
        interests: ["陪伴"],
        availability: ["weekend"],
      },
    },
    // qk.me prefix covers qk.myTasks / qk.myRewards via ["me"] → both.
    expectedKeys: [qk.task(taskId), qk.me, qk.leaderboardAll],
  },
  {
    name: "useCreateJoinRequest",
    useHook: useCreateJoinRequest,
    handler: http.post(`/api/v1/teams/${teamId}/join-requests`, () =>
      HttpResponse.json(joinRequestRow),
    ),
    args: teamId,
    expectedKeys: [qk.team(teamId), qk.myTeams],
  },
  {
    name: "useCancelJoinRequest",
    useHook: useCancelJoinRequest,
    handler: http.delete(
      `/api/v1/teams/${teamId}/join-requests/${reqId}`,
      () => new HttpResponse(null, { status: 204 }),
    ),
    args: { teamId, reqId },
    expectedKeys: [qk.team(teamId), qk.myTeams],
  },
  {
    name: "useApproveJoinRequest",
    useHook: useApproveJoinRequest,
    handler: http.post(`/api/v1/teams/${teamId}/join-requests/${reqId}/approve`, () =>
      HttpResponse.json(f.teamJetLed),
    ),
    args: { teamId, reqId },
    // qk.me prefix covers qk.myTeams / qk.myTasks / qk.myRewards.
    expectedKeys: [qk.team(teamId), qk.me, qk.leaderboardAll],
  },
  {
    name: "useRejectJoinRequest",
    useHook: useRejectJoinRequest,
    handler: http.post(
      `/api/v1/teams/${teamId}/join-requests/${reqId}/reject`,
      () => new HttpResponse(null, { status: 204 }),
    ),
    args: { teamId, reqId },
    expectedKeys: [qk.myTeams, qk.team(teamId)],
  },
  {
    name: "useLeaveTeam",
    useHook: useLeaveTeam,
    handler: http.post(
      `/api/v1/teams/${teamId}/leave`,
      () => new HttpResponse(null, { status: 204 }),
    ),
    args: teamId,
    // qk.me prefix covers qk.myTeams / qk.myTasks / qk.myRewards.
    expectedKeys: [qk.team(teamId), qk.me, qk.leaderboardAll],
  },
  {
    name: "usePatchTeam",
    useHook: usePatchTeam,
    handler: http.patch(`/api/v1/teams/${teamId}`, () => HttpResponse.json(f.teamJetLed)),
    args: { teamId, body: { alias: "new alias" } },
    expectedKeys: [qk.team(teamId), qk.myTeams, qk.teamsAll],
  },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("default-invalidate map", () => {
  it.each(cases)(
    "$name invalidates expected keys on success",
    async ({ useHook, handler, args, expectedKeys }) => {
      server.use(handler);
      const qc = makeClient();
      const spy = vi.spyOn(qc, "invalidateQueries");
      const { result } = renderHook(useHook, {
        wrapper: ({ children }) => <Wrapper client={qc}>{children}</Wrapper>,
      });

      result.current.mutate(args);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const calledKeys = spy.mock.calls.map(([opts]) => (opts as { queryKey: unknown }).queryKey);
      expect(calledKeys).toEqual(expect.arrayContaining([...expectedKeys]));
    },
  );
});
