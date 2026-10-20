import {
  apiListCache,
  getCacheStrategy,
  immutableCache,
  noCache,
  shortCache,
} from "./cacheHeaders";
import { publicCdnCacheHeaders } from "./cdn";

describe("cache header policies", () => {
  it("returns the required immutable, short, list, and private policies", () => {
    expect(immutableCache()).toBe("public, max-age=31536000, immutable");
    expect(shortCache(30)).toBe("public, max-age=30, stale-while-revalidate=210");
    expect(noCache()).toBe("private, no-store");
    expect(apiListCache()).toBe("private, max-age=0, stale-while-revalidate=60");
  });

  it("selects immutable caching for Next static assets and fonts", () => {
    expect(getCacheStrategy("/_next/static/chunks/app.js").directive).toBe(immutableCache());
    expect(getCacheStrategy("/fonts/clipcash.woff2").directive).toBe(immutableCache());
  });

  it("uses public media caching and private user-response caching", () => {
    expect(getCacheStrategy("/images/thumbnail.webp").directive).toContain("max-age=86400");
    expect(getCacheStrategy("/api/user/profile").directive).toBe(noCache());
    expect(getCacheStrategy("/api/earnings/transactions").directive).toBe(noCache());
  });

  it("sets CDN edge policy and content invalidation keys for public APIs", () => {
    expect(publicCdnCacheHeaders("explore-clips", 60, 300)).toEqual({
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
      "CDN-Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Surrogate-Key": "explore-clips",
    });
  });
});
