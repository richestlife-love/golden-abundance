import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "../../test/msw/server";
import { AuthProvider, useAuth } from "../session";
import { tokenStore } from "../token";
import { qk } from "../../queries/keys";
import * as f from "../../test/msw/fixtures";

function probe(qc: QueryClient) {
  function Probe() {
    const { isSignedIn, signIn, signOut } = useAuth();
    return (
      <div>
        <div data-testid="signed">{String(isSignedIn)}</div>
        <button onClick={() => signIn("jet@demo.gal")}>in</button>
        <button onClick={() => signOut()}>out</button>
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

afterEach(() => {
  tokenStore.clear();
});

describe("AuthProvider", () => {
  it("starts signed out when no token in localStorage", () => {
    const qc = new QueryClient();
    probe(qc);
    expect(screen.getByTestId("signed")).toHaveTextContent("false");
  });

  it("starts signed in when a token already exists", () => {
    tokenStore.set("existing");
    const qc = new QueryClient();
    probe(qc);
    expect(screen.getByTestId("signed")).toHaveTextContent("true");
  });

  it("signIn stores the token and seeds qk.me", async () => {
    server.use(http.post("/api/v1/auth/google", () => HttpResponse.json(f.authResponseJet)));
    const qc = new QueryClient();
    probe(qc);
    act(() => {
      screen.getByText("in").click();
    });
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("true"));
    expect(tokenStore.get()).toBe(f.authResponseJet.access_token);
    expect(qc.getQueryData(qk.me)).toEqual(f.userJet);
  });

  it("signOut clears the token and the cache", async () => {
    tokenStore.set("existing");
    const qc = new QueryClient();
    qc.setQueryData(qk.me, f.userJet);
    probe(qc);
    server.use(http.post("/api/v1/auth/logout", () => new HttpResponse(null, { status: 204 })));
    act(() => {
      screen.getByText("out").click();
    });
    await waitFor(() => expect(screen.getByTestId("signed")).toHaveTextContent("false"));
    expect(tokenStore.get()).toBeNull();
    expect(qc.getQueryData(qk.me)).toBeUndefined();
  });
});
