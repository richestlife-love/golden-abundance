import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../session";
import {
  makeFakeSupabase,
  makeSession,
  type FakeSupabaseHandle,
} from "../../test/supabase-mock";
import { setSupabaseClientForTesting } from "../../lib/supabase";
import { qk } from "../../queries/keys";

function probe(qc: QueryClient, onSignIn?: (returnTo?: string) => void) {
  function Probe() {
    const { isSignedIn, signIn, signOut } = useAuth();
    return (
      <div>
        <div data-testid="signed">{String(isSignedIn)}</div>
        <button onClick={() => void signIn(onSignIn ? "/tasks/T1" : undefined)}>in</button>
        <button onClick={() => void signOut()}>out</button>
      </div>
    );
  }
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

let fake: FakeSupabaseHandle;

beforeEach(() => {
  fake = makeFakeSupabase();
  setSupabaseClientForTesting(fake.client);
});

afterEach(() => {
  setSupabaseClientForTesting(null);
});

describe("AuthProvider", () => {
  it("starts signed out when there is no Supabase session", async () => {
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("false"));
  });

  it("starts signed in when Supabase already has a session", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("true"));
  });

  it("signIn() calls supabase.auth.signInWithOAuth with Google + callback URL", async () => {
    const qc = new QueryClient();
    probe(qc);
    act(() => {
      screen.getByText("in").click();
    });
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    expect(fake.signInCalls[0].provider).toBe("google");
    expect(fake.signInCalls[0].redirectTo).toMatch(/\/auth\/callback$/);
  });

  it("signIn(returnTo) encodes returnTo in the callback URL", async () => {
    const qc = new QueryClient();
    probe(qc, () => {});
    act(() => {
      screen.getByText("in").click();
    });
    await waitFor(() => expect(fake.signInCalls).toHaveLength(1));
    const url = new URL(fake.signInCalls[0].redirectTo!);
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("returnTo")).toBe("/tasks/T1");
  });

  it("signOut() calls supabase.auth.signOut and clears qk.me", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    qc.setQueryData(qk.me, { id: "x" });
    probe(qc);
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("true"));

    act(() => {
      screen.getByText("out").click();
    });

    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("false"));
    expect(fake.signOutCalls).toBe(1);
    expect(qc.getQueryData(qk.me)).toBeUndefined();
  });

  it("reacts to external auth state changes (e.g. expiry from another tab)", async () => {
    fake.setSession(makeSession());
    const qc = new QueryClient();
    probe(qc);
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("true"));

    act(() => {
      fake.setSession(null);
    });

    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("false"));
  });
});
