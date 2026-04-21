import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./msw/server";
import { setSupabaseClientForTesting } from "../lib/supabase";
import { makeFakeSupabase, makeSession } from "./supabase-mock";

// Node 22+ ships an experimental `localStorage` global that shadows jsdom's
// implementation and lacks the standard Storage methods (`getItem`,
// `setItem`, `removeItem`, `clear`). Detect that broken shell and replace it
// with an in-memory Storage shim so app code can rely on the standard API.
function ensureWorkingLocalStorage(): void {
  const existing = window.localStorage as Storage | undefined;
  if (existing && typeof existing.getItem === "function") return;

  const data = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    key(index) {
      return Array.from(data.keys())[index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: shim,
  });
  // Also pin it on globalThis so module-level `localStorage` lookups
  // (without the `window.` prefix) resolve to the working shim.
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: shim,
  });
}

beforeAll(() => {
  ensureWorkingLocalStorage();
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
