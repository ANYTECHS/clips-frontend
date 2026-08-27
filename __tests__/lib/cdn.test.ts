/**
 * Tests for app/lib/cdn.ts
 */

import {
  cdnUrl,
  cdnStaticUrl,
  getCdnOrigin,
  getCdnPurgeEndpoint,
  purgeCdnPath,
  purgeCdnPaths,
  isCdnAvailable,
  resolveAssetUrl,
  _resetCdnAvailabilityCache,
  STATIC_ASSET_CACHE_CONTROL,
  PUBLIC_ASSET_CACHE_CONTROL,
  NO_STORE_CACHE_CONTROL,
  isrCacheControl,
} from "@/app/lib/cdn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Synchronous-only env helper — safe for sync tests.
 * Do NOT pass async callbacks; env vars will be restored before awaits settle.
 */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  }
}

// Install a global fetch mock so jest.fn() / mockResolvedValue work.
// The jsdom test environment does not provide fetch natively.
global.fetch = jest.fn() as jest.Mock;
const mockFetch = global.fetch as jest.Mock;

beforeEach(() => {
  _resetCdnAvailabilityCache();
  mockFetch.mockReset();
  delete process.env.NEXT_PUBLIC_CDN_URL;
  delete process.env.CDN_PURGE_SECRET;
  delete process.env.CDN_PURGE_API_URL;
});

// ---------------------------------------------------------------------------
// getCdnOrigin
// ---------------------------------------------------------------------------

describe("getCdnOrigin", () => {
  it("returns undefined when env var is not set", () => {
    expect(getCdnOrigin()).toBeUndefined();
  });

  it("returns the origin without trailing slash", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev/" }, () => {
      expect(getCdnOrigin()).toBe("https://cdn.clipcash.dev");
    });
  });

  it("returns undefined for blank string", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "  " }, () => {
      expect(getCdnOrigin()).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// cdnUrl
// ---------------------------------------------------------------------------

describe("cdnUrl", () => {
  it("returns the path unchanged when no CDN is configured", () => {
    expect(cdnUrl("/images/hero.png")).toBe("/images/hero.png");
  });

  it("prepends the CDN origin when configured", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev" }, () => {
      expect(cdnUrl("/images/hero.png")).toBe(
        "https://cdn.clipcash.dev/images/hero.png",
      );
    });
  });

  it("adds a leading slash when path does not have one", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev" }, () => {
      expect(cdnUrl("images/hero.png")).toBe(
        "https://cdn.clipcash.dev/images/hero.png",
      );
    });
  });

  it("passes through absolute URLs unchanged", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev" }, () => {
      expect(cdnUrl("https://other.example.com/file.png")).toBe(
        "https://other.example.com/file.png",
      );
    });
  });

  it("returns empty string unchanged", () => {
    expect(cdnUrl("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// cdnStaticUrl
// ---------------------------------------------------------------------------

describe("cdnStaticUrl", () => {
  it("routes _next/static paths through the CDN", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev" }, () => {
      expect(cdnStaticUrl("/_next/static/chunks/main.js")).toBe(
        "https://cdn.clipcash.dev/_next/static/chunks/main.js",
      );
    });
  });

  it("returns the path as-is when no CDN is configured", () => {
    expect(cdnStaticUrl("/_next/static/chunks/main.js")).toBe(
      "/_next/static/chunks/main.js",
    );
  });
});

// ---------------------------------------------------------------------------
// Cache-Control constants
// ---------------------------------------------------------------------------

describe("cache-control constants", () => {
  it("STATIC_ASSET_CACHE_CONTROL includes immutable", () => {
    expect(STATIC_ASSET_CACHE_CONTROL).toContain("immutable");
    expect(STATIC_ASSET_CACHE_CONTROL).toContain("max-age=31536000");
  });

  it("PUBLIC_ASSET_CACHE_CONTROL includes stale-while-revalidate", () => {
    expect(PUBLIC_ASSET_CACHE_CONTROL).toContain("stale-while-revalidate");
  });

  it("NO_STORE_CACHE_CONTROL prevents caching", () => {
    expect(NO_STORE_CACHE_CONTROL).toContain("no-store");
    expect(NO_STORE_CACHE_CONTROL).toContain("private");
  });

  it("isrCacheControl uses the provided revalidate window", () => {
    const header = isrCacheControl(60);
    expect(header).toContain("s-maxage=60");
    expect(header).toContain("stale-while-revalidate");
  });

  it("isrCacheControl stale window does not go negative", () => {
    const header = isrCacheControl(99999999);
    expect(header).toContain("stale-while-revalidate=0");
  });
});

// ---------------------------------------------------------------------------
// getCdnPurgeEndpoint
// ---------------------------------------------------------------------------

describe("getCdnPurgeEndpoint", () => {
  it("returns undefined when neither CDN_PURGE_API_URL nor CDN URL is set", () => {
    expect(getCdnPurgeEndpoint()).toBeUndefined();
  });

  it("returns the explicit CDN_PURGE_API_URL when set", () => {
    withEnv({ CDN_PURGE_API_URL: "https://purge.example.com/purge" }, () => {
      expect(getCdnPurgeEndpoint()).toBe("https://purge.example.com/purge");
    });
  });

  it("derives the endpoint from the CDN origin as a fallback", () => {
    withEnv({ NEXT_PUBLIC_CDN_URL: "https://cdn.clipcash.dev" }, () => {
      expect(getCdnPurgeEndpoint()).toBe("https://cdn.clipcash.dev/api/purge");
    });
  });
});

// ---------------------------------------------------------------------------
// purgeCdnPaths
// ---------------------------------------------------------------------------

describe("purgeCdnPaths", () => {
  it("succeeds silently when no purge endpoint is configured", async () => {
    const result = await purgeCdnPaths(["/images/thumb.jpg"]);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/skipped/i);
  });

  it("returns failure when endpoint is set but secret is missing", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    const result = await purgeCdnPaths(["/images/thumb.jpg"]);
    expect(result.success).toBe(false);
  });

  it("calls the purge endpoint and returns success on 200", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    process.env.CDN_PURGE_SECRET = "test-secret";

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await purgeCdnPaths(["/images/thumb.jpg"]);
    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://cdn.clipcash.dev/api/purge",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
        }),
      }),
    );
  });

  it("returns failure when the purge API returns a non-ok status", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    process.env.CDN_PURGE_SECRET = "test-secret";

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    });

    const result = await purgeCdnPaths(["/images/thumb.jpg"]);
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
  });

  it("handles network errors gracefully", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    process.env.CDN_PURGE_SECRET = "test-secret";

    mockFetch.mockRejectedValueOnce(new Error("Network down"));

    const result = await purgeCdnPaths(["/images/thumb.jpg"]);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/failed/i);
  });
});

// ---------------------------------------------------------------------------
// purgeCdnPath (single-path convenience)
// ---------------------------------------------------------------------------

describe("purgeCdnPath", () => {
  it("wraps purgeCdnPaths with a single path", async () => {
    const result = await purgeCdnPath("/og-image.png");
    // No CDN configured — succeeds silently.
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isCdnAvailable
// ---------------------------------------------------------------------------

describe("isCdnAvailable", () => {
  afterEach(() => {
    _resetCdnAvailabilityCache();
  });

  it("returns false when no CDN is configured", async () => {
    expect(await isCdnAvailable()).toBe(false);
  });

  it("returns true when CDN responds with a 2xx status", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockResolvedValueOnce({ status: 200 });
    expect(await isCdnAvailable()).toBe(true);
  });

  it("returns false when CDN responds with a 5xx status", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockResolvedValueOnce({ status: 503 });
    expect(await isCdnAvailable()).toBe(false);
  });

  it("returns false on network error", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    expect(await isCdnAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveAssetUrl
// ---------------------------------------------------------------------------

describe("resolveAssetUrl", () => {
  afterEach(() => {
    _resetCdnAvailabilityCache();
  });

  it("returns the original path when no CDN is configured", async () => {
    expect(await resolveAssetUrl("/avatar.png")).toBe("/avatar.png");
  });

  it("returns a CDN URL when CDN is available", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockResolvedValueOnce({ status: 200 });

    const url = await resolveAssetUrl("/avatar.png");
    expect(url).toBe("https://cdn.clipcash.dev/avatar.png");
  });

  it("falls back to the original path when CDN is unavailable", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockRejectedValueOnce(new Error("down"));

    const url = await resolveAssetUrl("/avatar.png");
    expect(url).toBe("/avatar.png");
  });

  it("reuses the cached availability result within TTL", async () => {
    process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.clipcash.dev";
    mockFetch.mockResolvedValueOnce({ status: 200 });

    await resolveAssetUrl("/a.png");
    await resolveAssetUrl("/b.png");
    // fetch should only be called once (the availability probe)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
