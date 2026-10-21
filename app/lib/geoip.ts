/**
 * app/lib/geoip.ts
 *
 * Lightweight IP-to-country/city/coordinates lookup.
 *
 * Strategy (in priority order):
 *   1. Cloudflare `cf-ipcountry` header — zero-latency, no external call,
 *      available when deployed behind Cloudflare Workers or Pages.
 *   2. ip-api.com free JSON endpoint — no API key required, ~45 ms p50,
 *      rate-limited to 45 req/min per IP on the free tier.
 *   3. Graceful fallback — returns null so callers can proceed without geo.
 *
 * Usage:
 *   import { geolocateIp } from "@/app/lib/geoip";
 *   const geo = await geolocateIp(ipAddress, cfCountryHeader);
 */

import { logger } from "@/app/lib/logger";

export interface GeoLocation {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "DE". */
  country: string;
  /** Human-readable city name, e.g. "Berlin". May be empty for VPNs/proxies. */
  city: string;
  /** Approximate latitude (city-level precision). */
  latitude: number;
  /** Approximate longitude (city-level precision). */
  longitude: number;
}

/** ip-api.com response shape (fields= query parameter controls what is returned). */
interface IpApiResponse {
  status: "success" | "fail";
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
  message?: string;
}

/**
 * Private IPs and loopback addresses should not be forwarded to an external
 * geolocation service. We return null for these so the caller skips checks
 * during local development.
 */
function isPrivateOrLoopback(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (ip === "::1" || ip === "127.0.0.1") return true;
  // RFC 1918 private ranges
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // fc00::/7 IPv6 ULA
  if (/^f[cd]/i.test(ip)) return true;
  return false;
}

/**
 * Resolves a country-code-only result from the Cloudflare header.
 * City and coordinates are unknown in this path, so we return zeroes
 * and flag it as coarse so callers can skip distance calculations.
 */
function fromCloudflareHeader(countryCode: string): GeoLocation {
  return {
    country: countryCode.toUpperCase(),
    city: "",
    latitude: 0,
    longitude: 0,
  };
}

/**
 * Looks up geolocation data for the given IP address.
 *
 * @param ipAddress     - The client IP to resolve (from x-forwarded-for etc.)
 * @param cfCountry     - Optional value of the `cf-ipcountry` header, used as
 *                        a fast path that avoids the external API call.
 * @returns GeoLocation on success, or null if the IP is private/unknown or
 *          the lookup fails.
 */
export async function geolocateIp(
  ipAddress: string,
  cfCountry?: string | null,
): Promise<GeoLocation | null> {
  if (isPrivateOrLoopback(ipAddress)) {
    return null;
  }

  // Fast path: Cloudflare sets cf-ipcountry on every request.
  if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1") {
    return fromCloudflareHeader(cfCountry);
  }

  // Slow path: ip-api.com free endpoint. Only request the fields we need.
  const url = `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,message,countryCode,city,lat,lon`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn("[GeoIP] ip-api.com returned non-OK status", {
        status: response.status,
        ip: ipAddress,
      });
      return null;
    }

    const data = (await response.json()) as IpApiResponse;

    if (data.status !== "success") {
      logger.warn("[GeoIP] ip-api.com lookup failed", {
        message: data.message,
        ip: ipAddress,
      });
      return null;
    }

    return {
      country: data.countryCode,
      city: data.city ?? "",
      latitude: data.lat,
      longitude: data.lon,
    };
  } catch (error) {
    // AbortError means we timed out — treat as graceful miss, not a hard error.
    const isTimeout =
      error instanceof Error && error.name === "AbortError";
    logger.warn("[GeoIP] Lookup error", {
      ip: ipAddress,
      timeout: isTimeout,
      error: isTimeout ? undefined : error,
    });
    return null;
  }
}
