import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

describe("checkpoints", () => {
  it("supports multiple named checkpoints", () => {
    const obj = tx({ n: 0 });
    obj.n = 1;
    obj.$save("one");
    obj.n = 2;
    obj.$save("two");
    obj.n = 3;
    obj.$save("three");
    expect(obj.$checkpoints()).toEqual(["one", "two", "three"]);
  });

  it("saving with an existing name overwrites the previous checkpoint", () => {
    const obj = tx({ n: 0 });
    obj.n = 1;
    obj.$save("c");
    obj.n = 2;
    obj.$save("c");
    obj.n = 99;
    obj.$rollback("c");
    expect(obj.n).toBe(2);
  });

  it("re-saving with an existing name moves it to the newest position", () => {
    const obj = tx({ n: 0 });
    obj.$save("a");
    obj.$save("b");
    obj.$save("a");
    expect(obj.$checkpoints()).toEqual(["b", "a"]);
  });

  it("rolling back to a checkpoint discards all later checkpoints", () => {
    const obj = tx({ n: 0 });
    obj.$save("a");
    obj.$save("b");
    obj.$save("c");
    obj.$rollback("a");
    expect(obj.$checkpoints()).toEqual([]);
  });

  it("rolling back consumes the named checkpoint itself", () => {
    const obj = tx({ n: 0 });
    obj.$save("a");
    obj.$rollback("a");
    expect(obj.$checkpoints()).toEqual([]);
  });

  it("throws when rolling back to a non-existent checkpoint", () => {
    const obj = tx({ n: 0 });
    expect(() => obj.$rollback("nope")).toThrow("Unknown checkpoint: nope");
  });

  it("throws when rolling back to a consumed checkpoint", () => {
    const obj = tx({ n: 0 });
    obj.$save("a");
    obj.$rollback("a");
    expect(() => obj.$rollback("a")).toThrow("Unknown checkpoint: a");
  });

  it("maxCheckpoints evicts the oldest entry on overflow", () => {
    const obj = tx({ n: 0 }, { maxCheckpoints: 2 });
    obj.$save("a");
    obj.$save("b");
    obj.$save("c");
    expect(obj.$checkpoints()).toEqual(["b", "c"]);
  });

  it("maxCheckpoints rejects non-positive values", () => {
    expect(() => tx({ n: 0 }, { maxCheckpoints: 0 })).toThrow(TypeError);
    expect(() => tx({ n: 0 }, { maxCheckpoints: -1 })).toThrow(TypeError);
    expect(() => tx({ n: 0 }, { maxCheckpoints: 1.5 })).toThrow(TypeError);
  });

  it("$rollback() with no args clears all checkpoints", () => {
    const obj = tx({ n: 0 });
    obj.$save("a");
    obj.$save("b");
    obj.$rollback();
    expect(obj.$checkpoints()).toEqual([]);
  });

  it("$save accepts an empty string as a name", () => {
    const obj = tx({ n: 0 });
    obj.$save("");
    obj.n = 5;
    obj.$rollback("");
    expect(obj.n).toBe(0);
  });

  it("$save rejects non-string names", () => {
    const obj = tx({ n: 0 });
    expect(() =>
      (obj as unknown as { $save(n: unknown): void }).$save(123),
    ).toThrow(TypeError);
  });
});
