import { restoreData, splitData } from "./internals.js";
import type { Tx, TxOptions } from "./types.js";

interface CheckpointStore {
  originalSnapshot: Record<string, unknown>;
  checkpoints: Map<string, Record<string, unknown>>;
}

export function tx<T extends object>(
  original: T,
  options: TxOptions = {},
): Tx<T> {
  validateOptions(options);

  const { data: originalData, functions: originalFunctions } = splitData(
    original,
  );

  // Build the working object with the same prototype as the input so that
  // class methods and `instanceof` checks keep working.
  const proto = Object.getPrototypeOf(original) as object | null;
  const working = Object.create(proto) as Record<string | symbol, unknown>;

  // Hydrate from a deep clone of the data, then attach functions and
  // symbol-keyed properties verbatim (they live outside the snapshot system).
  Object.assign(working, structuredClone(originalData));
  for (const [key, value] of Object.entries(originalFunctions)) {
    working[key] = value;
  }
  for (const sym of Object.getOwnPropertySymbols(original)) {
    working[sym] = (original as Record<symbol, unknown>)[sym];
  }

  const store: CheckpointStore = {
    originalSnapshot: structuredClone(originalData),
    checkpoints: new Map(),
  };

  const maxCheckpoints = options.maxCheckpoints;

  attachTxMethod(working, "$save", (name: string) => {
    if (typeof name !== "string") {
      throw new TypeError(`$save requires a string name, got ${typeof name}`);
    }
    const { data } = splitData(working);
    // Re-saving an existing name moves it to the newest position. Delete first
    // so Map insertion order reflects the re-save.
    if (store.checkpoints.has(name)) store.checkpoints.delete(name);
    store.checkpoints.set(name, structuredClone(data));
    if (
      maxCheckpoints !== undefined &&
      store.checkpoints.size > maxCheckpoints
    ) {
      const oldest = store.checkpoints.keys().next().value as string;
      store.checkpoints.delete(oldest);
    }
  });

  attachTxMethod(working, "$rollback", (name?: string) => {
    let snapshot: Record<string, unknown>;
    if (name === undefined) {
      snapshot = store.originalSnapshot;
      store.checkpoints.clear();
    } else {
      const found = store.checkpoints.get(name);
      if (found === undefined) {
        throw new Error(`Unknown checkpoint: ${name}`);
      }
      snapshot = found;
      // Drop the named checkpoint and everything saved after it. Matches
      // SQL ROLLBACK TO SAVEPOINT semantics.
      const keys = Array.from(store.checkpoints.keys());
      const idx = keys.indexOf(name);
      for (let i = idx; i < keys.length; i++) {
        store.checkpoints.delete(keys[i]);
      }
    }
    restoreData(working as Record<string, unknown>, snapshot);
  });

  attachTxMethod(working, "$checkpoints", () =>
    Array.from(store.checkpoints.keys()),
  );

  attachTxMethod(working, "$plain", () => {
    const { data } = splitData(working);
    return structuredClone(data) as T;
  });

  attachTxMethod(working, "$clearCheckpoints", () => {
    store.checkpoints.clear();
  });

  return working as Tx<T>;
}

function validateOptions(o: TxOptions): void {
  if (o.maxCheckpoints !== undefined) {
    if (!Number.isInteger(o.maxCheckpoints) || o.maxCheckpoints < 1) {
      throw new TypeError(
        `maxCheckpoints must be a positive integer, got ${o.maxCheckpoints}`,
      );
    }
  }
}

function attachTxMethod(
  target: Record<string | symbol, unknown>,
  name: string,
  value: unknown,
): void {
  Object.defineProperty(target, name, {
    value,
    enumerable: false,
    configurable: true,
    writable: false,
  });
}
