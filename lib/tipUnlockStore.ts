/**
 * tipUnlockStore
 *
 * Persists which clips a wallet address has already tipped and unlocked.
 * Once a (clipId, senderAddress) pair is stored, the user never sees the
 * tip gate again for that clip — they get a direct Download button.
 *
 * Issue #1368 — the stored list contains wallet addresses (PII), so the
 * payload is AES-256-GCM encrypted at rest via lib/secureStorage. Legacy
 * plaintext values are transparently migrated (re-encrypted) on first write
 * after hydration.
 *
 * Storage key: "clp_unlocked_clips" (value: "v1.<salt>.<iv>.<ct>" or legacy JSON)
 * Format:      JSON array of "clipId:address" strings (encrypted at rest)
 */

import { encryptPII, decryptPII } from "./secureStorage";

const KEY = "clp_unlocked_clips";

// In-memory cache so the synchronous read API keeps working; hydration is
// async because WebCrypto is async-only. Until hydration completes,
// isUnlocked() returns false (fail-closed for the tip gate UX only — the
// server still enforces payment).
let cache: Set<string> | null = null;
let hydratePromise: Promise<Set<string>> | null = null;

async function hydrate(): Promise<Set<string>> {
  if (cache) return cache;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const set = new Set<string>();
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) {
            const dec = await decryptPII(raw);
            const body = dec ?? raw; // legacy plaintext migration path
            const arr = JSON.parse(body);
            if (Array.isArray(arr)) arr.forEach((v) => set.add(String(v)));
          }
        } catch {
          // corrupted value — start fresh
        }
      }
      cache = set;
      return set;
    })();
  }
  return hydratePromise;
}

// Kick off hydration eagerly on module load in the browser.
if (typeof window !== "undefined") {
  void hydrate();
}

async function persist(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const blob = await encryptPII(JSON.stringify([...set]));
    localStorage.setItem(KEY, blob);
  } catch {}
}

function key(clipId: string, address: string) {
  return `${clipId}:${address.toLowerCase()}`;
}

/** Record that `address` has paid the tip for `clipId`. */
export function markUnlocked(clipId: string, address: string) {
  const set = cache ?? new Set<string>();
  cache = set;
  set.add(key(clipId, address));
  void persist(set);
}

/** Returns true if `address` has already unlocked `clipId`. */
export function isUnlocked(clipId: string, address?: string | null): boolean {
  if (!address || !cache) return false;
  return cache.has(key(clipId, address));
}

/** Async variant that waits for hydration — prefer in effects/handlers. */
export async function isUnlockedAsync(clipId: string, address?: string | null): Promise<boolean> {
  if (!address) return false;
  const set = await hydrate();
  return set.has(key(clipId, address));
}
