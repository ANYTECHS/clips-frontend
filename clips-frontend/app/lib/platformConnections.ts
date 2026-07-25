/**
 * In-memory platform connections store.
 *
 * Mirrors the pattern used elsewhere in the project (e.g. jobStore in
 * app/api/jobs/[id]/route.ts) — no external database adapter is present,
 * so connections live in-process and are cleared on server restart.
 *
 * Schema mirrors the spec requirement:
 *   platform_connections (userId, platform, accessToken, refreshToken, username, connectedAt)
 */

export type SocialPlatform = "google" | "apple" | "tiktok" | "youtube" | "instagram" | "twitter";

export interface PlatformConnection {
  userId: string;
  platform: SocialPlatform;
  /** Encrypted / raw access token — handle with care, never log */
  accessToken: string | null;
  /** Encrypted / raw refresh token */
  refreshToken: string | null;
  /** Display handle or channel name returned by the provider */
  username: string | null;
  connectedAt: string; // ISO-8601
}

/**
 * Keyed by `${userId}::${platform}` so look-ups and upserts are O(1).
 */
const store = new Map<string, PlatformConnection>();

function key(userId: string, platform: SocialPlatform) {
  return `${userId}::${platform}`;
}

/** Upsert a connection. Creates a new record or replaces the existing one. */
export function upsertConnection(conn: PlatformConnection): void {
  store.set(key(conn.userId, conn.platform), { ...conn });
}

/** Return all connections for a given user (ordered by connectedAt desc). */
export function getConnections(userId: string): PlatformConnection[] {
  const result: PlatformConnection[] = [];
  for (const conn of store.values()) {
    if (conn.userId === userId) result.push(conn);
  }
  return result.sort(
    (a, b) => new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
  );
}

/** Remove a specific platform connection. Returns true if a record was deleted. */
export function deleteConnection(userId: string, platform: SocialPlatform): boolean {
  return store.delete(key(userId, platform));
}

/** Check whether a user has a specific platform connected. */
export function hasConnection(userId: string, platform: SocialPlatform): boolean {
  return store.has(key(userId, platform));
}
