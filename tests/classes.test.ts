import { describe, it, expect } from "vitest";
import { tx } from "../src/index.js";

class Account {
  balance: number;
  constructor(balance: number) {
    this.balance = balance;
  }
  withdraw(n: number): void {
    this.balance -= n;
  }
  describe(): string {
    return `balance: ${this.balance}`;
  }
}

describe("class instances", () => {
  it("preserves prototype-chain methods", () => {
    const acc = tx(new Account(100));
    expect(typeof acc.withdraw).toBe("function");
    acc.withdraw(20);
    expect(acc.balance).toBe(80);
  });

  it("preserves the instanceof relationship", () => {
    const acc = tx(new Account(100));
    expect(acc instanceof Account).toBe(true);
  });

  it("class methods still work after rollback", () => {
    const acc = tx(new Account(100));
    acc.$save("c");
    acc.withdraw(50);
    expect(acc.balance).toBe(50);
    acc.$rollback("c");
    expect(acc.balance).toBe(100);
    acc.withdraw(10);
    expect(acc.balance).toBe(90);
  });

  it("does not mutate the input class instance", () => {
    const original = new Account(100);
    const acc = tx(original);
    acc.withdraw(50);
    expect(original.balance).toBe(100);
    expect(acc.balance).toBe(50);
  });

  it("describe() reflects the current balance after rollback", () => {
    const acc = tx(new Account(100));
    acc.$save("c");
    acc.balance = 42;
    expect(acc.describe()).toBe("balance: 42");
    acc.$rollback("c");
    expect(acc.describe()).toBe("balance: 100");
  });
});
