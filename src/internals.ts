export interface SplitResult {
  data: Record<string, unknown>;
  functions: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Split an object's own string-keyed enumerable properties into data
 * (snapshot-tracked) and functions (pass-through). Symbol-keyed properties
 * are handled by the caller separately because they live outside the
 * snapshot system entirely.
 */
export function splitData(obj: object): SplitResult {
  const data: Record<string, unknown> = {};
  const functions: Record<string, (...args: unknown[]) => unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "function") {
      functions[key] = value as (...args: unknown[]) => unknown;
    } else {
      data[key] = value;
    }
  }
  return { data, functions };
}

/**
 * Replace the data portion of `target` with a clone of `snapshot`. Functions
 * on `target` are preserved untouched. Symbol-keyed properties are left
 * alone because Object.keys only iterates string keys.
 */
export function restoreData(
  target: Record<string, unknown>,
  snapshot: Record<string, unknown>,
): void {
  // Drop current non-function string-keyed own properties.
  for (const key of Object.keys(target)) {
    if (typeof target[key] !== "function") {
      delete target[key];
    }
  }
  // Re-assign from a fresh clone of the snapshot so the live object stays
  // independent of the stored snapshot (later mutations on either side
  // cannot leak across).
  const cloned = structuredClone(snapshot);
  for (const key of Object.keys(cloned)) {
    target[key] = cloned[key];
  }
}
