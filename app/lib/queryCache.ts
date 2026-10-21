/**
 * In-process TTL cache for read-heavy database queries (#1174).
 *
 * Wrap a Prisma read in `cachedQuery(key, ttlMs, fn)`; concurrent callers for
 * the same key share one in-flight promise. Invalidate after writes with
 * `invalidateQuery(prefix)`. Hit/miss counters feed query performance
 * monitoring via `getQueryCacheStats()`.
 */

interface Entry {
  value: Promise<unknown>;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const stats = { hits: 0, misses: 0 };

export async function cachedQuery<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    stats.hits++;
    return hit.value as Promise<T>;
  }
  stats.misses++;
  const value = fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  // Never cache failures.
  value.catch(() => store.delete(key));
  return value;
}

/** Drops every entry whose key starts with `prefix` (e.g. `"user:123"`). */
export function invalidateQuery(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function getQueryCacheStats() {
  const total = stats.hits + stats.misses;
  return { ...stats, size: store.size, hitRate: total ? stats.hits / total : 0 };
}

export function clearQueryCache(): void {
  store.clear();
  stats.hits = 0;
  stats.misses = 0;
}
