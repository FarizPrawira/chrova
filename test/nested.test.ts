import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

describe("nested values", () => {
  it("restores nested plain objects", () => {
    const obj = tx({ user: { name: "John Doe", age: 30 } });
    obj.$save("c");
    obj.user.name = "Edited";
    obj.user.age = 99;
    obj.$rollback("c");
    expect(obj.user).toEqual({ name: "John Doe", age: 30 });
  });

  it("restores nested arrays after various mutations", () => {
    const obj = tx({ items: [1, 2, 3] });
    obj.$save("c");
    obj.items.push(4);
    obj.items[0] = 99;
    obj.items.length = 1;
    obj.$rollback("c");
    expect(obj.items).toEqual([1, 2, 3]);
  });

  it("restores Date instances", () => {
    const start = new Date("2025-01-01T00:00:00Z");
    const obj = tx({ when: start });
    obj.$save("c");
    obj.when = new Date("2099-12-31T00:00:00Z");
    obj.$rollback("c");
    expect(obj.when).toBeInstanceOf(Date);
    expect(obj.when.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("restores Map instances", () => {
    const obj = tx({ m: new Map<string, number>([["a", 1]]) });
    obj.$save("c");
    obj.m.set("b", 2);
    obj.m.delete("a");
    obj.$rollback("c");
    expect(Array.from(obj.m.entries())).toEqual([["a", 1]]);
  });

  it("restores Set instances", () => {
    const obj = tx({ s: new Set([1, 2, 3]) });
    obj.$save("c");
    obj.s.add(4);
    obj.s.delete(1);
    obj.$rollback("c");
    expect(Array.from(obj.s)).toEqual([1, 2, 3]);
  });

  it("nested references acquired before rollback diverge from the live object", () => {
    const obj = tx({ user: { name: "John Doe", age: 30 } });
    const ref = obj.user;
    obj.$save("c");
    obj.user.age = 99;
    obj.$rollback("c");
    // Live object is restored.
    expect(obj.user.age).toBe(30);
    // But the captured reference is stale: it still points to the
    // pre-rollback nested object, which carries the mutation.
    expect(ref.age).toBe(99);
    expect(ref).not.toBe(obj.user);
  });

  it("deeply nested mutations are restored", () => {
    const obj = tx({ a: { b: { c: { d: 1 } } } });
    obj.$save("c");
    obj.a.b.c.d = 99;
    obj.$rollback("c");
    expect(obj.a.b.c.d).toBe(1);
  });
});

describe("complex structures", () => {
  it("restores an array of objects after element mutation", () => {
    const obj = tx({
      users: [
        { id: 1, name: "John Doe", active: true },
        { id: 2, name: "Alice", active: false },
      ],
    });
    obj.$save("c");
    obj.users[0].name = "Edited";
    obj.users[1].active = true;
    obj.$rollback("c");
    expect(obj.users).toEqual([
      { id: 1, name: "John Doe", active: true },
      { id: 2, name: "Alice", active: false },
    ]);
  });

  it("restores an array of objects after structural changes", () => {
    const obj = tx({
      items: [{ id: 1, qty: 1 }] as Array<{ id: number; qty: number }>,
    });
    obj.$save("c");
    obj.items.push({ id: 2, qty: 5 });
    obj.items.push({ id: 3, qty: 9 });
    obj.items.splice(0, 1);
    obj.$rollback("c");
    expect(obj.items).toEqual([{ id: 1, qty: 1 }]);
  });

  it("restores a nested object containing an array of objects", () => {
    const obj = tx({
      cart: {
        id: "cart-1",
        owner: "John Doe",
        lines: [
          { sku: "A", qty: 2, price: 10 },
          { sku: "B", qty: 1, price: 25 },
        ],
      },
    });
    obj.$save("c");
    obj.cart.owner = "Stranger";
    obj.cart.lines[0].qty = 99;
    obj.cart.lines.push({ sku: "C", qty: 7, price: 5 });
    obj.$rollback("c");
    expect(obj.cart).toEqual({
      id: "cart-1",
      owner: "John Doe",
      lines: [
        { sku: "A", qty: 2, price: 10 },
        { sku: "B", qty: 1, price: 25 },
      ],
    });
  });

  it("restores arrays nested inside arrays (matrix-like)", () => {
    const obj = tx({
      grid: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    });
    obj.$save("c");
    obj.grid[1][1] = 999;
    obj.grid.push([10, 11, 12]);
    obj.$rollback("c");
    expect(obj.grid).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
  });

  it("restores arrays of objects that themselves contain arrays", () => {
    const obj = tx({
      orders: [
        { id: 1, tags: ["urgent", "vip"] },
        { id: 2, tags: ["standard"] },
      ],
    });
    obj.$save("c");
    obj.orders[0].tags.push("delayed");
    obj.orders[1].tags[0] = "rush";
    obj.orders.push({ id: 3, tags: [] });
    obj.$rollback("c");
    expect(obj.orders).toEqual([
      { id: 1, tags: ["urgent", "vip"] },
      { id: 2, tags: ["standard"] },
    ]);
  });

  it("restores a realistic shopping cart shape end to end", () => {
    interface Cart {
      id: string;
      customer: { id: number; name: string; addresses: string[] };
      items: Array<{ sku: string; qty: number; meta: { gift: boolean } }>;
      totals: { subtotal: number; tax: number };
    }
    const cart = tx<Cart>({
      id: "cart-42",
      customer: {
        id: 1,
        name: "John Doe",
        addresses: ["Jakarta", "Bandung"],
      },
      items: [
        { sku: "A", qty: 1, meta: { gift: false } },
        { sku: "B", qty: 2, meta: { gift: true } },
      ],
      totals: { subtotal: 100, tax: 10 },
    });

    cart.$save("checkout-ready");

    // Apply a series of mutations across the whole shape.
    cart.customer.name = "Stranger";
    cart.customer.addresses.push("Surabaya");
    cart.items[0].qty = 99;
    cart.items[1].meta.gift = false;
    cart.items.push({ sku: "C", qty: 7, meta: { gift: true } });
    cart.totals.subtotal = 0;
    cart.totals.tax = 0;

    cart.$rollback("checkout-ready");

    expect(cart).toMatchObject({
      id: "cart-42",
      customer: {
        id: 1,
        name: "John Doe",
        addresses: ["Jakarta", "Bandung"],
      },
      items: [
        { sku: "A", qty: 1, meta: { gift: false } },
        { sku: "B", qty: 2, meta: { gift: true } },
      ],
      totals: { subtotal: 100, tax: 10 },
    });
  });

  it("each checkpoint of a complex structure is independent", () => {
    const obj = tx({
      users: [{ id: 1, name: "John Doe" }] as Array<{ id: number; name: string }>,
    });
    obj.$save("one-user");
    obj.users.push({ id: 2, name: "Alice" });
    obj.$save("two-users");
    obj.users.push({ id: 3, name: "Bob" });
    obj.$save("three-users");

    obj.$rollback("two-users");
    expect(obj.users).toEqual([
      { id: 1, name: "John Doe" },
      { id: 2, name: "Alice" },
    ]);
  });
});
