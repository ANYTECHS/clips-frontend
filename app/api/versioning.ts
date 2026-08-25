/**
 * app/api/versioning.ts
 *
 * API versioning strategy for ClipCash.
 *
 * ## Strategy
 *
 * Versions are expressed as `v{major}` prefixes in the URL path:
 *   /api/v1/upload   ← current stable
 *   /api/v2/upload   ← future breaking change
 *
 * Un-prefixed routes (`/api/upload`) are treated as the **current default
 * version** so existing clients continue to work with zero changes.
 *
 * ## Lifecycle
 *
 * CURRENT   — fully supported, no deprecation warnings.
 * DEPRECATED — still works but adds `Deprecation` + `Sunset` headers so
 *              clients know to upgrade.  Gives consumers ≥ 6 months notice.
 * RETIRED   — returns 410 Gone immediately.
 *
 * ## Usage in route handlers
 *
 * ```ts
 * import { resolveVersion, addVersionHeaders } from "@/app/api/versioning";
 *
 * export async function GET(req: NextRequest) {
 *   const version = resolveVersion(req);
 *   const res = NextResponse.json({ data: "…", error: null });
 *   addVersionHeaders(res, version);
 *   return res;
 * }
 * ```
 *
 * Issue #889 – API versioning strategy.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Version registry ─────────────────────────────────────────────────────────

export type ApiVersion = "v1" | "v2";

type VersionStatus = "current" | "deprecated" | "retired";

interface VersionMeta {
  status: VersionStatus;
  /**
   * ISO date after which the version is considered sunset (only for
   * deprecated versions).  Sent as the `Sunset` response header so tooling
   * can surface it to developers.
   */
  sunsetDate?: string;
  /** Human-readable note added to the Deprecation-Notice header. */
  deprecationNote?: string;
}

const VERSION_REGISTRY: Record<ApiVersion, VersionMeta> = {
  v1: {
    status: "current",
  },
  v2: {
    // Placeholder for the next major version — not yet released.
    status: "current",
  },
};

/** The version served when no explicit version prefix is found in the URL. */
export const DEFAULT_VERSION: ApiVersion = "v1";

/** The latest stable version.  Included in every response as `API-Version`. */
export const CURRENT_VERSION: ApiVersion = "v1";

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * resolveVersion — infer the requested API version from the incoming request.
 *
 * Checks (in order):
 * 1. URL path prefix  → `/api/v1/…`, `/api/v2/…`
 * 2. `X-API-Version` header  → "v1", "v2"
 * 3. `api-version` query param  → "v1", "v2"
 * 4. Falls back to DEFAULT_VERSION.
 */
export function resolveVersion(request: NextRequest): ApiVersion {
  // 1. Path prefix
  const pathname = request.nextUrl.pathname;
  const pathMatch = pathname.match(/\/api\/(v\d+)\//);
  if (pathMatch) {
    const candidate = pathMatch[1] as ApiVersion;
    if (candidate in VERSION_REGISTRY) return candidate;
  }

  // 2. Header
  const headerVersion = request.headers.get("x-api-version");
  if (headerVersion && headerVersion in VERSION_REGISTRY) {
    return headerVersion as ApiVersion;
  }

  // 3. Query param
  const queryVersion = request.nextUrl.searchParams.get("api-version");
  if (queryVersion && queryVersion in VERSION_REGISTRY) {
    return queryVersion as ApiVersion;
  }

  return DEFAULT_VERSION;
}

// ── Response headers ─────────────────────────────────────────────────────────

/**
 * addVersionHeaders — attach versioning metadata to an outgoing response.
 *
 * Always sets:
 *   `API-Version: v1`          — the version that handled this request
 *   `X-API-Latest: v1`         — the current stable version
 *
 * When the resolved version is deprecated, also sets:
 *   `Deprecation: true`
 *   `Sunset: <ISO date>`
 *   `Link: <migration URL>; rel="successor-version"`
 *
 * When the version is retired, returns 410 Gone instead of modifying the
 * response so the caller can short-circuit.
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion
): NextResponse {
  const meta = VERSION_REGISTRY[version];

  response.headers.set("API-Version", version);
  response.headers.set("X-API-Latest", CURRENT_VERSION);

  if (meta.status === "deprecated") {
    response.headers.set("Deprecation", "true");
    if (meta.sunsetDate) {
      response.headers.set("Sunset", meta.sunsetDate);
    }
    if (meta.deprecationNote) {
      response.headers.set("Deprecation-Notice", meta.deprecationNote);
    }
    response.headers.set(
      "Link",
      `</api/${CURRENT_VERSION}>; rel="successor-version"`
    );
  }

  return response;
}

/**
 * rejectRetiredVersion — return a 410 Gone if the version has been retired.
 *
 * Returns `null` when the version is still usable, or a NextResponse with
 * status 410 when it has been retired.  Route handlers should check this
 * before doing any work.
 *
 * @example
 * ```ts
 * const gone = rejectRetiredVersion(version);
 * if (gone) return gone;
 * ```
 */
export function rejectRetiredVersion(version: ApiVersion): NextResponse | null {
  const meta = VERSION_REGISTRY[version];
  if (meta.status !== "retired") return null;

  return NextResponse.json(
    {
      error: `API version ${version} has been retired. Please migrate to ${CURRENT_VERSION}.`,
      code: "VERSION_RETIRED",
      migrateUrl: `/api/${CURRENT_VERSION}`,
    },
    {
      status: 410,
      headers: {
        "API-Version": version,
        "X-API-Latest": CURRENT_VERSION,
        Link: `</api/${CURRENT_VERSION}>; rel="successor-version"`,
      },
    }
  );
}

// ── Convenience wrapper ───────────────────────────────────────────────────────

/**
 * withVersioning — higher-order helper that resolves the version, rejects
 * retired versions, and attaches headers to the returned response.
 *
 * @example
 * ```ts
 * export function GET(req: NextRequest) {
 *   return withVersioning(req, (version) => {
 *     return NextResponse.json({ data: "…", error: null });
 *   });
 * }
 * ```
 */
export async function withVersioning(
  request: NextRequest,
  handler: (version: ApiVersion) => NextResponse | Promise<NextResponse>
): Promise<NextResponse> {
  const version = resolveVersion(request);

  const gone = rejectRetiredVersion(version);
  if (gone) return gone;

  const response = await handler(version);
  return addVersionHeaders(response, version);
}
