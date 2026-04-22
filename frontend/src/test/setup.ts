import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./msw/server";
import { setSupabaseClientForTesting } from "../lib/supabase";
import { makeFakeSupabase, makeSession } from "./supabase-mock";

// The localStorage shim and window.scrollTo stub are installed by
// ./setup-pre.ts, which runs before this file so they're in place before MSW
// (transitively imported below) touches them at module-load time.

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  // Default to a signed-in fake Supabase client so unit tests that
  // indirectly call apiFetch (via query/mutation hooks) get a bearer
  // token without each test wiring its own Supabase fake. Tests that
  // care about the signed-out case install their own fake via
  // setSupabaseClientForTesting + setSession(null).
  const fake = makeFakeSupabase();
  fake.setSession(makeSession());
  setSupabaseClientForTesting(fake.client);
});
afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
  setSupabaseClientForTesting(null);
});
afterAll(() => server.close());
