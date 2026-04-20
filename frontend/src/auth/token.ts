const KEY = "gal.token";

export const tokenStore = {
  get(): string | null {
    return localStorage.getItem(KEY);
  },
  set(token: string): void {
    localStorage.setItem(KEY, token);
  },
  clear(): void {
    localStorage.removeItem(KEY);
  },
};
