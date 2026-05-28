import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

describe("tx() basic operations", () => {
  it("returns a wrapped object with $-methods", () => {
    const obj = tx({ a: 1 });
    expect(typeof obj.$save).toBe("function");
    expect(typeof obj.$rollback).toBe("function");
    expect(typeof obj.$checkpoints).toBe("function");
    expect(typeof obj.$plain).toBe("function");
    expect(typeof obj.$clearCheckpoints).toBe("function");
  });

  it("does not mutate the original object", () => {
    const original = { a: 1, b: 2 };
    const obj = tx(original);
    obj.a = 99;
    expect(original.a).toBe(1);
    expect(original.b).toBe(2);
  });

  it("allows property mutations on the wrapped object", () => {
    const obj = tx({ a: 1 });
    obj.a = 5;
    expect(obj.a).toBe(5);
  });

  it("allows new properties to be added", () => {
    const obj = tx<{ a: number; b?: number }>({ a: 1 });
    obj.b = 2;
    expect(obj.b).toBe(2);
  });

  it("$save then $rollback restores state", () => {
    const obj = tx({ a: 1, b: 2 });
    obj.$save("checkpoint");
    obj.a = 99;
    obj.b = 88;
    obj.$rollback("checkpoint");
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
  });

  it("$rollback() with no args returns to the original state", () => {
    const obj = tx({ a: 1 });
    obj.a = 99;
    obj.$save("c");
    obj.a = 88;
    obj.$rollback();
    expect(obj.a).toBe(1);
  });

  it("$rollback() drops properties that were added after tx()", () => {
    const obj = tx<{ a: number; b?: number }>({ a: 1 });
    obj.b = 2;
    obj.$rollback();
    expect(obj.b).toBeUndefined();
  });

  it("$checkpoints() returns names in insertion order", () => {
    const obj = tx({ a: 1 });
    obj.$save("first");
    obj.$save("second");
    obj.$save("third");
    expect(obj.$checkpoints()).toEqual(["first", "second", "third"]);
  });

  it("$plain() returns a clone without $-methods", () => {
    const obj = tx({ a: 1, b: 2 });
    const plain = obj.$plain();
    expect(plain).toEqual({ a: 1, b: 2 });
    expect((plain as Record<string, unknown>).$save).toBeUndefined();
  });

  it("$plain() returns a clone, not a live reference", () => {
    const obj = tx({ nested: { value: 1 } });
    const plain = obj.$plain();
    plain.nested.value = 99;
    expect(obj.nested.value).toBe(1);
  });

  it("$clearCheckpoints() empties checkpoints but keeps the original reachable", () => {
    const obj = tx({ a: 1 });
    obj.$save("c");
    obj.a = 99;
    obj.$clearCheckpoints();
    expect(obj.$checkpoints()).toEqual([]);
    obj.$rollback();
    expect(obj.a).toBe(1);
  });
});
