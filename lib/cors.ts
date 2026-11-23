// Issue #1370 — CORS origin allowlist.
//
// Credentialed API routes must never reflect arbitrary origins. Allowed
// origins come from ALLOWED_ORIGINS (comma-separated). Requests without an
// Origin header (same-origin navigations, curl, server-to-server) are
// allowed — browsers always send Origin on cross-origin credentialed calls.

import { apiError } from "./apiResponse";

const DEFAULT_ORIGINS = [
  "https://enclips.ai",
  "https://www.enclips.ai",
];

export function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (env && env.trim()) {
    return env.split(",").map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

/**
 * Returns true when the request may proceed:
 *  - no Origin header (non-browser client / same-origin), or
 *  - Origin is in the allowlist.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

/**
 * Credentialed-route guard. Returns a 403 Response for disallowed origins,
 * or null when the request is allowed.
 */
export function rejectDisallowedOrigin(
  req: { headers: Headers },
  requestId?: string,
): Response | null {
  const origin = req.headers.get("origin");
  // Only enforce on credentialed methods — GET/HEAD carry no CSRF-able state
  // change, but credentialed reads are still cross-origin sensitive, so we
  // check every request that presents an Origin header.
  if (isOriginAllowed(origin)) return null;
  return apiError(403, "Origin not allowed.", { code: "ORIGIN_NOT_ALLOWED", requestId });
}
