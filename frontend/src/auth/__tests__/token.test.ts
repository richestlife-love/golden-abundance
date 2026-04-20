import { afterEach, describe, expect, it } from "vitest";
import { tokenStore } from "../token";

afterEach(() => tokenStore.clear());

describe("tokenStore", () => {
  it("returns null when unset", () => {
    expect(tokenStore.get()).toBeNull();
  });
  it("round-trips set/get", () => {
    tokenStore.set("abc");
    expect(tokenStore.get()).toBe("abc");
  });
  it("clear removes the key", () => {
    tokenStore.set("abc");
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
  });
});
