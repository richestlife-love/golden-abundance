// Runs before setup.ts so the shims are in place BEFORE any module (notably
// MSW's cookieStore, imported transitively via ./msw/server) touches these
// globals. setup.ts installed the shim in `beforeAll`, which is too late —
// module-load-time access hits Node's native implementations and emits noise.

// Node 22+ ships an experimental `localStorage` global that shadows jsdom's
// implementation, lacks the standard Storage methods, and warns on every
// access ("--localstorage-file was provided without a valid path"). Even a
// `typeof localStorage` check wakes the native getter and emits the warning,
// so install an in-memory shim unconditionally — don't probe first.
const data = new Map<string, string>();
const storageShim: Storage = {
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
Object.defineProperty(window, "localStorage", { configurable: true, value: storageShim });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storageShim });

// jsdom doesn't implement Window#scrollTo; TanStack Router calls it on
// navigation, producing "Not implemented: Window's scrollTo() method" noise.
Object.defineProperty(window, "scrollTo", { configurable: true, value: () => {} });
