import { ApiError } from "./errors";
import { getSupabaseClient } from "../lib/supabase";

type SessionExpiredHandler = ((opts: { returnTo: string }) => void) | null;

let onSessionExpired: SessionExpiredHandler = null;

export function setSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

const BASE = "/api/v1";

async function currentAccessToken(): Promise<string | null> {
  // Async localStorage read via the SDK. Sub-millisecond in practice —
  // the SDK caches the session in memory and only touches storage on
  // startup or cross-tab sync.
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await currentAccessToken();
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.body != null) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    onSessionExpired?.({
      returnTo: window.location.pathname + window.location.search,
    });
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body.detail === "string") detail = body.detail;
    } catch {
      // body wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
