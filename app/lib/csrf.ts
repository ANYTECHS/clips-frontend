/**
 * CSRF protection for custom Next.js API routes.
 *
 * NextAuth handles CSRF for /api/auth/* automatically. All other
 * state-mutating routes (POST, PATCH, DELETE) must call `checkCsrf` at the
 * top of the handler.
 *
 * Strategy: Origin / Referer header validation against NEXTAUTH_URL.
 *   - Browsers always send Origin on cross-origin requests (and on same-origin
 *     POSTs in modern browsers). When Origin is absent the Referer header is
 *     used as a fallback (some proxies strip Origin).
 *   - Server-side callers (SSR, curl, trusted services) that deliberately omit
 *     both headers are permitted by setting `allowMissingOrigin: true` in the
 *     call-site options — this is off by default so every browser-initiated
 *     cross-site POST is rejected.
 *
 * Why not a token? Double-submit cookies require coordination with the client.
 * Origin/Referer checking is simpler, has no client-side overhead, and is
 * sufficient when the app does not use credentialed cross-origin requests from
 * trusted third-party pages (which it does not).
 */

import { logger } from "@/app/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export interface CsrfOptions {
  /**
   * Allow requests that carry neither an Origin nor a Referer header.
   * Disable only when a route must accept server-to-server calls that omit
   * both headers. Defaults to false.
   */
  allowMissingOrigin?: boolean;
}

/**
 * Validates that the request originates from the same origin as NEXTAUTH_URL.
 *
 * @returns `null` when the request is allowed, or a `NextResponse` with
 *          status 403 when it should be blocked.
 */
export function checkCsrf(
  request: NextRequest,
  options: CsrfOptions = {}
): NextResponse | null {
  const { allowMissingOrigin = false } = options;

  const appOrigin = resolveAppOrigin();

  // Extract the origin from Origin header first, fall back to Referer.
  const requestOrigin = extractOrigin(request);

  if (!requestOrigin) {
    if (allowMissingOrigin) return null;
    return forbidden("Missing Origin/Referer header");
  }

  if (!appOrigin) {
    // NEXTAUTH_URL is not configured — warn and allow so that local dev
    // without a full .env does not hard-block. validateEnv will have already
    // warned about this at startup.
    logger.warn(
      "[csrf] NEXTAUTH_URL is not set; skipping origin check. " +
        "Set NEXTAUTH_URL to enable CSRF protection."
    );
    return null;
  }

  if (requestOrigin !== appOrigin) {
    return forbidden(
      `Origin "${requestOrigin}" does not match app origin "${appOrigin}"`
    );
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveAppOrigin(): string | null {
  const raw = process.env.NEXTAUTH_URL;
  if (!raw) return null;
  try {
    const { origin } = new URL(raw);
    return origin; // e.g. "https://app.clipcash.ai"
  } catch {
    return null;
  }
}

function extractOrigin(request: NextRequest): string | null {
  // Prefer the Origin header — it contains only the origin (no path).
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") {
    // Normalise: strip trailing slash, lower-case scheme+host.
    try {
      const { origin: parsed } = new URL(origin);
      return parsed;
    } catch {
      return null;
    }
  }

  // Fall back to Referer and extract just the origin component.
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const { origin: parsed } = new URL(referer);
      return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

function forbidden(reason: string): NextResponse {
  // Log server-side so the reason is visible in server logs without leaking it
  // to the caller (which only receives a terse message).
  logger.warn(`[csrf] Blocked request: ${reason}`);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
