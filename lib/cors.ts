// Issue #1370 — CORS origin allowlist.
//
// Credentialed API routes must never reflect arbitrary origins. Allowed
// origins come from ALLOWED_ORIGINS (comma-separated). Requests without an
// Origin header (same-origin navigations, curl, server-to-server) are
// allowed — browsers always send Origin on cross-origin credentialed calls.

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
