import { NextResponse } from "next/server";
import { generateETag } from "@/app/lib/cacheHeaders";

/**
 * HTTP/CDN response caching for public API routes (#1175).
 *
 * - `Cache-Control` for browsers, `CDN-Cache-Control` for the edge (s-maxage).
 * - Strong ETag so revalidations return `304 Not Modified` with no body.
 * - Content-derived ETags make invalidation automatic: when data changes the
 *   ETag changes and the CDN/browser fetch the new representation.
 */

export interface ResponseCacheOptions {
  /** Browser max-age in seconds. */
  maxAge: number;
  /** Shared/CDN max-age in seconds. Defaults to `maxAge`. */
  sMaxAge?: number;
  /** stale-while-revalidate window in seconds. */
  staleWhileRevalidate?: number;
}

const stats = { hits: 0, misses: 0 };

export function cachedJson(request: Request | undefined, body: unknown, opts: ResponseCacheOptions): NextResponse {
  const payload = JSON.stringify(body);
  const etag = generateETag(payload);
  const swr = opts.staleWhileRevalidate ?? opts.maxAge * 5;
  const headers = {
    "Cache-Control": `public, max-age=${opts.maxAge}, stale-while-revalidate=${swr}`,
    "CDN-Cache-Control": `public, s-maxage=${opts.sMaxAge ?? opts.maxAge}, stale-while-revalidate=${swr}`,
    ETag: etag,
    Vary: "Accept-Encoding",
  };

  if (request?.headers.get("if-none-match") === etag) {
    stats.hits++;
    return new NextResponse(null, { status: 304, headers });
  }
  stats.misses++;
  return new NextResponse(payload, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/** Conditional-request hit rate (304s / total) for monitoring. */
export function getResponseCacheStats() {
  const total = stats.hits + stats.misses;
  return { ...stats, hitRate: total ? stats.hits / total : 0 };
}
