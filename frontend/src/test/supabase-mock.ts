import type { AuthError, Session, SupabaseClient, User } from "@supabase/supabase-js";

/** Minimal fake matching the surface src/ uses. Add fields on demand; don't speculate. */
export interface FakeSupabaseHandle {
  client: SupabaseClient;
  setSession: (session: Session | null) => void;
  signInCalls: Array<{ provider: string; redirectTo?: string }>;
  signOutCalls: number;
  exchangeCalls: string[];
  /** Pre-set to an Error-like object to make the next exchangeCodeForSession call fail. */
  nextExchangeError: AuthError | null;
}

export function makeFakeSupabase(): FakeSupabaseHandle {
  let session: Session | null = null;
  const listeners = new Set<(event: string, s: Session | null) => void>();
  const handle: FakeSupabaseHandle = {
    client: null as unknown as SupabaseClient,
    signInCalls: [],
    signOutCalls: 0,
    exchangeCalls: [],
    nextExchangeError: null,
    setSession: (s) => {
      session = s;
      for (const l of listeners) l(s ? "SIGNED_IN" : "SIGNED_OUT", s);
    },
  };

  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      onAuthStateChange: (cb: (event: string, s: Session | null) => void) => {
        listeners.add(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => listeners.delete(cb),
            },
          },
        };
      },
      signInWithOAuth: (args: { provider: string; options?: { redirectTo?: string } }) => {
        handle.signInCalls.push({
          provider: args.provider,
          redirectTo: args.options?.redirectTo,
        });
        return Promise.resolve({ data: { provider: args.provider, url: null }, error: null });
      },
      signOut: () => {
        handle.signOutCalls += 1;
        session = null;
        for (const l of listeners) l("SIGNED_OUT", null);
        return Promise.resolve({ error: null });
      },
      exchangeCodeForSession: (query: string) => {
        handle.exchangeCalls.push(query);
        if (handle.nextExchangeError) {
          const error = handle.nextExchangeError;
          handle.nextExchangeError = null;
          return Promise.resolve({ data: { session: null, user: null }, error });
        }
        const s = makeSession();
        session = s;
        for (const l of listeners) l("SIGNED_IN", s);
        return Promise.resolve({ data: { session: s, user: s.user }, error: null });
      },
    },
  } as unknown as SupabaseClient;

  handle.client = client;
  return handle;
}

/** Helper: minimal Session with a stable access_token for apiFetch tests. */
export function makeSession(accessToken = "test-access-token", user?: Partial<User>): Session {
  return {
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: {
      id: user?.id ?? "11111111-2222-3333-4444-555555555555",
      email: user?.email ?? "jet@demo.ga",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as User,
  } as Session;
}
