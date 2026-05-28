export interface TxOptions {
  /**
   * Maximum number of named checkpoints to keep. When exceeded, the oldest
   * checkpoint is evicted (FIFO). Default: unlimited.
   */
  maxCheckpoints?: number;
}

export type Tx<T extends object> = T & {
  /** Save the current state as a named checkpoint. */
  $save(name: string): void;
  /**
   * Restore to a named checkpoint, or to the original state if no name is
   * given. Throws if the named checkpoint does not exist.
   *
   * Rolling back to a named checkpoint discards that checkpoint and every
   * checkpoint saved after it (DB savepoint semantics).
   */
  $rollback(name?: string): void;
  /** Return current checkpoint names in insertion order. */
  $checkpoints(): string[];
  /** Return a plain object clone, suitable for JSON serialization. */
  $plain(): T;
  /** Clear all named checkpoints. The original state remains reachable. */
  $clearCheckpoints(): void;
};
