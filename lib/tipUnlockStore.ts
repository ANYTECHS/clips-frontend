/**
 * tipUnlockStore
 *
 * Persists which clips a wallet address has already tipped and unlocked.
 * Once a (clipId, senderAddress) pair is stored, the user never sees the
 * tip gate again for that clip — they get a direct Download button.
 *
 * Storage key: "clp_unlocked_clips"
 * Format:      JSON array of "clipId:address" strings
 */

const KEY = "clp_unlocked_clips";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function save(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {}
}

function key(clipId: string, address: string) {
  return `${clipId}:${address.toLowerCase()}`;
}

/** Record that `address` has paid the tip for `clipId`. */
export function markUnlocked(clipId: string, address: string) {
  const set = load();
  set.add(key(clipId, address));
  save(set);
}

/** Returns true if `address` has already unlocked `clipId`. */
export function isUnlocked(clipId: string, address?: string | null): boolean {
  if (!address) return false;
  return load().has(key(clipId, address));
}
