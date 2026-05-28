# chrova

[![npm version](https://img.shields.io/npm/v/chrova.svg)](https://www.npmjs.com/package/chrova)
[![npm downloads](https://img.shields.io/npm/dm/chrova.svg)](https://www.npmjs.com/package/chrova)
![zero dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![types included](https://img.shields.io/badge/types-included-blue)
[![license MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Transactional in-memory objects for TypeScript and JavaScript. Mutate freely, save named checkpoints, roll back like a database savepoint. No Proxy, no immutability requirement, no framework.

- Wraps any plain object or class instance, returns it with `$save` / `$rollback` methods attached
- Named checkpoints with insertion-ordered eviction (`maxCheckpoints`)
- `$rollback(name)` follows SQL savepoint semantics, dropping the named checkpoint and everything after it
- `$rollback()` with no name returns to the original state
- Preserves prototype chain, `instanceof`, and class methods
- Snapshot-based via `structuredClone`, supports primitives, plain objects, arrays, Date, Map, Set, RegExp
- Function-valued properties pass through untouched, never restored on rollback
- Zero runtime dependencies, ships with TypeScript types
- Tiny surface area, one entry point, five methods

```ts
import { tx } from "chrova";

// Wrap any object. The original is never mutated.
const order = tx({ items: [] as Item[], total: 0 });

order.items.push({ id: 1, price: 10 });
order.total += 10;
order.$save("after-first-item");

order.items.push({ id: 2, price: 9999 }); // oops
order.total += 9999;

order.$rollback("after-first-item");
// order is back to { items: [{ id: 1, price: 10 }], total: 10 }

order.$rollback();
// order is back to the original { items: [], total: 0 }
```

## Install

```sh
npm install chrova
# or
pnpm add chrova
# or
yarn add chrova
# or
bun add chrova
```

Both ESM and CommonJS are shipped:

```ts
import { tx } from "chrova";          // ESM / TypeScript
const { tx } = require("chrova");     // CommonJS
```

Requires Node >= 20 (uses the built-in `structuredClone`).

## Why

Most of the time you can mutate an object freely. Sometimes, midway through a multi-step routine, you discover the steps were wrong and you want everything to go back. Without a primitive for this you end up scattering deep clones, dirty flags, and rollback bookkeeping across your code.

A circuit breaker for state. A savepoint for plain objects. That is chrova.

The name is *chrono* (time) + *vault* (safekeeping). Like a database savepoint, but for the in-memory objects you already have.

## API

### `tx(original, options?)`

Wrap an object so that its property mutations can be rolled back to a saved checkpoint, or to the original state.

The original object is never mutated; chrova operates on an internal deep clone with the prototype of the input preserved.

**Options**

| Option           | Type                        | Default     | Description                                                            |
| ---------------- | --------------------------- | ----------- | ---------------------------------------------------------------------- |
| `maxCheckpoints` | `number` (positive integer) | `Infinity`  | Cap on named checkpoints. When exceeded, the oldest is evicted (FIFO). |

Use `maxCheckpoints` to cap memory automatically when `$save` runs in a loop, since each checkpoint holds a `structuredClone` of your data.

**Returned object**

The returned object has the same shape and prototype as the input, plus five non-enumerable methods:

```ts
type Tx<T extends object> = T & {
  $save(name: string): void;
  $rollback(name?: string): void;
  $checkpoints(): string[];
  $plain(): T;
  $clearCheckpoints(): void;
};
```

### `$save(name)`

Save the current state as a named checkpoint. Saving with an existing name overwrites the previous checkpoint and moves it to the newest position in insertion order. If `maxCheckpoints` is set and exceeded, the oldest entry is evicted.

### `$rollback(name?)`

Restore state to a saved checkpoint, or to the original state if no name is given.

Rolling back to a named checkpoint follows SQL `ROLLBACK TO SAVEPOINT` semantics: the named checkpoint and every checkpoint saved after it are discarded. The original state is always reachable via `$rollback()` with no argument.

Throws `Error("Unknown checkpoint: NAME")` if the named checkpoint does not exist (including names that were consumed by an earlier rollback).

### `$checkpoints()`

Return the current checkpoint names in insertion order.

### `$plain()`

Return a deep clone of the current data state with no `$-` methods. Suitable for `JSON.stringify`, returning to callers, or assertions in tests. Mutating the result does not affect the transaction.

### `$clearCheckpoints()`

Clear all named checkpoints. The original state remains reachable via `$rollback()` with no argument.

## Behavior contract

### What gets restored on rollback

Own enumerable properties whose values are:

- Primitives (string, number, boolean, bigint, null, undefined)
- Plain objects and arrays (recursively)
- Date, Map, Set, RegExp instances (cloned via `structuredClone`)

### What passes through untouched

- Properties whose values are functions
- Symbol-keyed properties
- The prototype chain (class methods, getters, setters)
- Non-enumerable properties

This means class instances keep their methods after rollback, and `instanceof` keeps working. It also means that if you mutate a function-valued property, that mutation survives rollback.

```ts
class User {
  constructor(public name: string) {}
  greet() { return `Hi, ${this.name}`; }    // on prototype, untouched
}

const user = tx(new User("John Doe"));
user.onClick = () => console.log("click");  // own function, NOT restored
user.$save("c");
user.name = "Edited";
user.onClick = () => console.log("new");
user.$rollback("c");

user.name;        // "John Doe" — restored
user.onClick();   // logs "new" — not restored
user.greet();     // "Hi, John Doe" — prototype method, always works
```

### Nested references diverge after rollback

References to nested objects or arrays acquired before `$rollback` are stale afterwards. Always access nested values through the root transaction object.

```ts
const obj = tx({ user: { name: "John Doe", age: 30 } });
const ref = obj.user;
obj.$save("c");
obj.user.age = 99;
obj.$rollback("c");

obj.user.age;       // 30
ref.age;            // 99 (stale)
ref === obj.user;   // false
```

### `$save` with an existing name

Overwrites the previous checkpoint of that name and moves it to the newest position in insertion order.

```ts
const obj = tx({ n: 0 });
obj.$save("a");
obj.$save("b");
obj.$save("a");                // re-save
obj.$checkpoints();            // ["b", "a"]
```

## License

MIT.
