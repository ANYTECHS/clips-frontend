/**
 * Cache Header Strategies
 * 
 * Defines cache policies for different types of static and dynamic assets.
 * Implements ETag support via conditional request handling and cache busting.
 * 
 * Cache Strategy Breakdown:
 * 1. Immutable assets (content-hashed): 1 year, immutable, public
 * 2. Static media (rarely changes): 24 hours + 7 days stale-while-revalidate
 * 3. API responses (dynamic): max-age varies by endpoint + stale-while-revalidate
 * 4. HTML (app shell): must revalidate on each request
 * 
 * See: https://web.dev/articles/http-cache
 */

export const CACHE_STRATEGIES = {
  // Immutable assets - Next.js content-hashes these, safe for aggressive caching
  immutable: {
    name: "immutable",
    maxAge: 31536000, // 1 year in seconds
    directive: "public, max-age=31536000, immutable",
  },

  // Static media assets that rarely change but are not content-hashed
  static: {
    name: "static",
    maxAge: 86400, // 24 hours
    staleTtl: 604800, // 7 days
    directive: "public, max-age=86400, stale-while-revalidate=604800",
  },

  // Fonts - similar to static but slightly longer TTL
  fonts: {
    name: "fonts",
    maxAge: 31536000, // 1 year
    directive: "public, max-age=31536000, immutable",
  },

  // API responses - shorter cache with revalidation window
  api: {
    name: "api",
    maxAge: 60, // 1 minute
    staleTtl: 300, // 5 minutes stale
    directive: "public, max-age=60, stale-while-revalidate=300",
  },

  // User-specific or sensitive data - no public caching
  private: {
    name: "private",
    maxAge: 3600, // 1 hour
    directive: "private, max-age=3600, must-revalidate",
  },

  // HTML pages - must validate cache freshness
  html: {
    name: "html",
    maxAge: 0,
    directive: "public, max-age=0, must-revalidate",
  },

  // Service worker - always revalidate
  serviceWorker: {
    name: "service-worker",
    maxAge: 0,
    directive: "public, max-age=0, must-revalidate",
  },
} as const;

/**
 * Determines cache strategy based on file path and type
 */
export function getCacheStrategy(pathname: string): (typeof CACHE_STRATEGIES)[keyof typeof CACHE_STRATEGIES] {
  // Next.js static build artifacts are content-hashed
  if (pathname.startsWith("/_next/static/")) {
    return CACHE_STRATEGIES.immutable;
  }

  // Service worker - always revalidate
  if (pathname === "/sw.js") {
    return CACHE_STRATEGIES.serviceWorker;
  }

  // Fonts from Google Fonts are immutable
  if (pathname.includes("/fonts/")) {
    return CACHE_STRATEGIES.fonts;
  }

  // Images and static media
  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|otf|eot)$/.test(pathname)) {
    return CACHE_STRATEGIES.static;
  }

  // HTML pages
  if (pathname.endsWith(".html") || pathname === "/") {
    return CACHE_STRATEGIES.html;
  }

  // API routes
  if (pathname.startsWith("/api/")) {
    return CACHE_STRATEGIES.api;
  }

  // Default: HTML with revalidation
  return CACHE_STRATEGIES.html;
}

/**
 * Generates ETag from content
 * Simple hash of content for cache validation
 */
export function generateETag(content: string | Buffer): string {
  // Simple hash: use length + checksum approach
  if (typeof content === "string") {
    content = Buffer.from(content);
  }
  
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * Cache busting utility - append hash to asset URLs
 * Used in build process to invalidate old assets when content changes
 */
export function cacheBustUrl(url: string, hash: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${hash}`;
}
