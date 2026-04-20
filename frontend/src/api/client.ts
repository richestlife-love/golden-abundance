import { tokenStore } from "../auth/token";
import { ApiError } from "./errors";

type SessionExpiredHandler = ((opts: { returnTo: string }) => void) | null;

let onSessionExpired: SessionExpiredHandler = null;

export function setSessionExpiredHandler(fn: SessionExpiredHandler): void {
  onSessionExpired = fn;
}

const BASE = "/api/v1";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
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
