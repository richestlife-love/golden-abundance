// frontend/src/api/auth.ts
import type { components } from "./schema";
import { apiFetch } from "./client";

type AuthResponse = components["schemas"]["AuthResponse"];
type GoogleAuthRequest = components["schemas"]["GoogleAuthRequest"];

export function postGoogleAuth(body: GoogleAuthRequest): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function postLogout(): Promise<void> {
  return apiFetch<void>("/auth/logout", { method: "POST" });
}
