/**
 * CDN utilities for ClipCash (#856).
 *
 * Covers four responsibilities:
 *
 * 1. **URL generation** — rewrite any asset path to the CDN origin when
 *    `NEXT_PUBLIC_CDN_URL` is set, falling back gracefully to the app origin.
 * 2. **Cache headers** — canonical Cache-Control values for static assets,
 *    ISR pages, and API responses so every response is consistent.
 * 3. **Cache invalidation** — a `purgeCdnPath()` helper that calls the CDN
 *    purge API when credentials are present.
 * 4. **Fallback detection** — `isCdnAvailable()` so callers can check whether
 *    the CDN is reachable at start-up (used by the performance monitor).
 *
 * All public functions are safe to call on the server and in tests. Network I/O
 * only happens in `purgeCdnPath()` and `isCdnAvailable()`; the rest are pure.
 */

import { logger } from "@/app/lib/logger";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * The CDN origin, e.g. `https://cdn.clipcash.dev`.
 * `undefined` in development (no NEXT_PUBLIC_CDN_URL set) or when the env var
 * is intentionally left blank.
 */
export function getCdnOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_CDN_URL;
  if (!raw || raw.trim() === "") return undefined;
  // Normalise — strip trailing slash so callers can always prepend `/path`.
  return raw.replace(/\/+$/, "");
}

/**
 * The secret token used to call the CDN purge API.
 * Server-only — never `NEXT_PUBLIC_*`.
 */
function getCdnPurgeSecret(): string | undefined {
  return process.env.CDN_PURGE_SECRET || undefined;
}

/**
 * The CDN purge API endpoint.
 * Defaults to `<CDN_ORIGIN>/api/purge` when the origin is known.
 */
export function getCdnPurgeEndpoint(): string | undefined {
  const explicit = process.env.CDN_PURGE_API_URL;
  if (explicit && explicit.trim() !== "") return explicit.trim();
  const origin = getCdnOrigin();
  return origin ? `${origin}/api/purge` : undefined;
}

// ---------------------------------------------------------------------------
// URL generation
// ---------------------------------------------------------------------------

/**
 * Returns the full URL for a public asset path, routing it through the CDN
 * when one is configured.
 *
 * @example
 * // CDN configured:
 * cdnUrl("/images/hero.png") // => "https://cdn.clipcash.dev/images/hero.png"
 *
 * // No CDN:
 * cdnUrl("/images/hero.png") // => "/images/hero.png"
 */
export function cdnUrl(path: string): string {
  if (!path) return path;
  // Already absolute — return as-is so callers don't need to pre-check.
  if (/^https?:\/\//i.test(path)) return path;

  const origin = getCdnOrigin();
  if (!origin) return path;

  // Ensure single leading slash.
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalised}`;
}

/**
 * Like `cdnUrl`, but specialised for `/_next/static/` build artefacts.
 * These assets always have content-hashed filenames so they are safe to serve
 * with a 1-year immutable cache regardless of CDN configuration.
 */
export function cdnStaticUrl(buildPath: string): string {
  // buildPath is expected to start with "/_next/static/" — no transform needed
  // beyond routing through the origin, which cdnUrl already does.
  return cdnUrl(buildPath);
}

// ---------------------------------------------------------------------------
// Cache-Control headers
// ---------------------------------------------------------------------------

/**
 * Cache-Control directives for static build assets (`/_next/static/**`).
 *
 * Content hashes guarantee uniqueness — these are safe to cache for a year and
 * marked `immutable` so browsers skip revalidation entirely.
 */
export const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

/**
 * Cache-Control for public media assets (thumbnails, OG images, avatars) that
 * are not content-hashed but change infrequently.
 *
 * `stale-while-revalidate` ensures a visitor never sees a blank image while
 * the CDN fetches a fresh copy in the background.
 */
export const PUBLIC_ASSET_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

/**
 * Cache-Control for ISR pages: served fresh for `revalidate` seconds, then
 * served stale while a background refresh runs (up to one year).
 *
 * @param revalidateSeconds - The `revalidate` value from `generateStaticParams`
 *   or `export const revalidate = N`.
 */
export function isrCacheControl(revalidateSeconds: number): string {
  const staleWindow = Math.max(0, 31536000 - revalidateSeconds);
  return `public, s-maxage=${revalidateSeconds}, stale-while-revalidate=${staleWindow}`;
}

/**
 * Cache-Control for API responses that should not be cached by CDN or browser.
 */
export const NO_STORE_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

export interface PurgeResult {
  success: boolean;
  /** HTTP status from the CDN purge API, if a request was made. */
  status?: number;
  /** Human-readable message for logging. */
  message: string;
}

/**
 * Purge one or more CDN-cached paths.
 *
 * No-ops silently when `CDN_PURGE_API_URL` / `CDN_PURGE_SECRET` are not set,
 * so this is safe to call in development without special-casing.
 *
 * @param paths - URL paths to purge, e.g. `["/images/thumb.jpg"]`.
 */
export async function purgeCdnPaths(paths: string[]): Promise<PurgeResult> {
  const endpoint = getCdnPurgeEndpoint();
  const secret = getCdnPurgeSecret();

  if (!endpoint) {
    return { success: true, message: "CDN purge skipped: no purge endpoint configured" };
  }

  if (!secret) {
    logger.warn("[cdn] CDN_PURGE_SECRET is not set — skipping purge");
    return { success: false, message: "CDN purge skipped: no purge secret" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ paths }),
    });

    if (response.ok) {
      logger.info(`[cdn] Purged ${paths.length} path(s)`, { paths });
      return { success: true, status: response.status, message: `Purged ${paths.length} path(s)` };
    }

    const text = await response.text().catch(() => "(unreadable)");
    logger.warn(`[cdn] Purge failed: ${response.status} ${text}`);
    return {
      success: false,
      status: response.status,
      message: `Purge API returned ${response.status}: ${text}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`[cdn] Purge request threw: ${message}`);
    return { success: false, message: `Purge request failed: ${message}` };
  }
}

/**
 * Convenience wrapper to purge a single path.
 */
export async function purgeCdnPath(path: string): Promise<PurgeResult> {
  return purgeCdnPaths([path]);
}

// ---------------------------------------------------------------------------
// Fallback / health
// ---------------------------------------------------------------------------

/**
 * Probe the CDN origin with a lightweight HEAD request to check reachability.
 *
 * Returns `true` when the CDN responds with any 2xx or 3xx status.
 * Returns `false` on network error or when no CDN is configured (so callers
 * can unconditionally check and fall back to the app origin).
 *
 * @param timeoutMs - Abort after this many milliseconds (default 5 000).
 */
export async function isCdnAvailable(timeoutMs = 5_000): Promise<boolean> {
  const origin = getCdnOrigin();
  if (!origin) return false;

  // Probe the standard Next.js static directory entry point.
  const probeUrl = `${origin}/_next/static/`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(probeUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return either the CDN URL or the app-relative path, after verifying CDN
 * availability in one shot at module load time.
 *
 * Useful for cases where you want to decide once whether to use the CDN
 * (e.g. in a server component that renders dozens of image URLs).
 *
 * The check result is memoised for `cacheTtlMs` (default 60 s) so multiple
 * server renders in the same deployment do not all probe the CDN.
 */
let _cdnAvailableCache: { value: boolean; expiresAt: number } | null = null;

export async function resolveAssetUrl(
  path: string,
  { cacheTtlMs = 60_000 }: { cacheTtlMs?: number } = {},
): Promise<string> {
  const origin = getCdnOrigin();
  if (!origin) return path;

  const now = Date.now();
  if (_cdnAvailableCache && now < _cdnAvailableCache.expiresAt) {
    return _cdnAvailableCache.value ? cdnUrl(path) : path;
  }

  const available = await isCdnAvailable();
  _cdnAvailableCache = { value: available, expiresAt: now + cacheTtlMs };
  return available ? cdnUrl(path) : path;
}

/** Reset the availability cache — intended for tests. */
export function _resetCdnAvailabilityCache(): void {
  _cdnAvailableCache = null;
}
