/**
 * Conflict resolution for data kept in sync across components (#909).
 *
 * Two writers can disagree about the current value of the same record: a
 * user's optimistic local edit and a server-pushed update (via SSE/polling)
 * can both be "in flight" at once. `resolveConflict` picks a winner with a
 * last-write-wins rule keyed on an `updatedAt` timestamp, and reports back
 * whether the two values actually disagreed so callers can surface that to
 * the sync status indicator instead of silently dropping one side.
 */

export interface Timestamped {
  updatedAt: number;
}

export interface ConflictResolution<T> {
  value: T;
  hadConflict: boolean;
  /** True when the remote value won over a pending local edit. */
  remoteWon: boolean;
}

/**
 * Resolve a conflict between a local (possibly optimistic) value and an
 * incoming remote value for the same record, using the newer `updatedAt`.
 *
 * A conflict is only reported when both sides actually differ — two writers
 * agreeing by coincidence isn't worth flagging.
 */
export function resolveConflict<T extends Timestamped>(
  local: T | null,
  remote: T,
): ConflictResolution<T> {
  if (local === null) {
    return { value: remote, hadConflict: false, remoteWon: true };
  }

  const isSameValue = JSON.stringify(local) === JSON.stringify(remote);
  if (isSameValue) {
    return { value: remote, hadConflict: false, remoteWon: true };
  }

  const remoteWon = remote.updatedAt >= local.updatedAt;
  return {
    value: remoteWon ? remote : local,
    hadConflict: true,
    remoteWon,
  };
}
