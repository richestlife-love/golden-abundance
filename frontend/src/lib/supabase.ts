import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Module-level singleton + test-friendly override. Mirrors the
// `setRouterRef` / `_setActiveQueryClient` DI patterns elsewhere in
// src/ — avoids `vi.mock` fragility in tests.
let _real: SupabaseClient | null = null;
let _override: SupabaseClient | null = null;

function createReal(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set " +
        "(see frontend/.env.example).",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE (default in @supabase/supabase-js v2). The callback route
      // explicitly calls `exchangeCodeForSession(window.location.search)`
      // to turn the `?code=...` into a session, so we disable
      // auto-detection — failures become observable instead of silent.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

export function getSupabaseClient(): SupabaseClient {
  if (_override) return _override;
  if (!_real) _real = createReal();
  return _real;
}

export function setSupabaseClientForTesting(client: SupabaseClient | null): void {
  _override = client;
}
