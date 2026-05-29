import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

describe("function properties", () => {
  it("passes own function properties through unchanged", () => {
    const fn = () => "hello";
    const obj = tx({ a: 1, fn });
    expect(obj.fn()).toBe("hello");
  });

  it("does not restore function properties on rollback", () => {
    const obj = tx<{ a: number; fn: () => string }>({
      a: 1,
      fn: () => "original",
    });
    obj.$save("c");
    obj.a = 99;
    obj.fn = () => "modified";
    obj.$rollback("c");
    expect(obj.a).toBe(1);
    expect(obj.fn()).toBe("modified");
  });

  it("functions added after tx() persist across rollback", () => {
    const obj = tx<{ a: number; added?: () => string }>({ a: 1 });
    obj.$save("c");
    obj.a = 99;
    obj.added = () => "new";
    obj.$rollback("c");
    expect(obj.a).toBe(1);
    expect(obj.added).toBeDefined();
    expect(obj.added!()).toBe("new");
  });

  it("$plain() omits function properties", () => {
    const obj = tx({ a: 1, fn: () => 1 });
    const plain = obj.$plain();
    expect(plain).toEqual({ a: 1 });
    expect((plain as Record<string, unknown>).fn).toBeUndefined();
  });
});
