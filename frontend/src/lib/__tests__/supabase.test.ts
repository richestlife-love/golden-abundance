import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getSupabaseClient, setSupabaseClientForTesting } from "../supabase";

beforeAll(() => {
  // getSupabaseClient()'s real factory reads these on first call. Stub
  // at file scope so every test in this file sees them. No .env.test
  // file needed — other tests install a fake via setSupabaseClientForTesting
  // and never trigger the real factory.
  vi.stubEnv("VITE_SUPABASE_URL", "https://test-ref.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test-key-not-real");
});

afterEach(() => setSupabaseClientForTesting(null));

describe("getSupabaseClient", () => {
  it("returns a singleton client", () => {
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });

  it("returns the test override when set", () => {
    const fake = {
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseClientForTesting(fake as any);
    expect(getSupabaseClient()).toBe(fake);
  });

  it("falls back to the real client after reset", () => {
    const fake = { any: "thing" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseClientForTesting(fake as any);
    expect(getSupabaseClient()).toBe(fake);
    setSupabaseClientForTesting(null);
    expect(getSupabaseClient()).not.toBe(fake);
  });
});
