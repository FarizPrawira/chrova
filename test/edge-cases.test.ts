import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

describe("edge cases", () => {
  it("handles an empty object", () => {
    const obj = tx<Record<string, number>>({});
    obj.x = 1;
    obj.$rollback();
    expect(Object.keys(obj)).toEqual([]);
  });

  it("handles an object with only function properties", () => {
    const obj = tx({ fn: () => 1 });
    obj.$save("c");
    obj.$rollback("c");
    expect(obj.fn()).toBe(1);
  });

  it("rollback on a fresh tx with no mutations is a no-op", () => {
    const obj = tx({ a: 1, b: 2 });
    obj.$rollback();
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
  });

  it("supports all primitive value types", () => {
    const obj = tx({
      str: "hello",
      num: 42,
      bool: true,
      big: 9007199254740993n,
      nul: null as null,
      undef: undefined as undefined,
    });
    obj.$save("c");
    obj.str = "modified";
    obj.num = -1;
    obj.bool = false;
    obj.$rollback("c");
    expect(obj.str).toBe("hello");
    expect(obj.num).toBe(42);
    expect(obj.bool).toBe(true);
    expect(obj.big).toBe(9007199254740993n);
    expect(obj.nul).toBeNull();
    expect(obj.undef).toBeUndefined();
  });

  it("supports very deep nesting", () => {
    const obj = tx({ l1: { l2: { l3: { l4: { l5: 1 } } } } });
    obj.$save("c");
    obj.l1.l2.l3.l4.l5 = 99;
    obj.$rollback("c");
    expect(obj.l1.l2.l3.l4.l5).toBe(1);
  });

  it("multiple sequential rollbacks compose correctly", () => {
    const obj = tx({ n: 0 });
    obj.n = 1;
    obj.$save("one");
    obj.n = 2;
    obj.$save("two");
    obj.n = 3;
    obj.$rollback("two");
    expect(obj.n).toBe(2);
    obj.n = 99;
    obj.$rollback();
    expect(obj.n).toBe(0);
  });

  it("$-methods are non-enumerable", () => {
    const obj = tx({ a: 1 });
    expect(Object.keys(obj)).toEqual(["a"]);
  });
});
