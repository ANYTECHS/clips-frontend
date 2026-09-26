/**
 * app/api/versioning.ts
 *
 * API versioning and negotiation strategy for ClipCash.
 *
 * ## Strategy
 *
 * Versions are expressed as `v{major}` prefixes in the URL path,
 * request headers (`X-API-Version`, `Accept-Version`), or query parameters (`api-version`, `version`).
 *   /api/v1/upload   ← current stable
 *   /api/v2/upload   ← future major version
 *
 * Un-prefixed requests without version indicators default to `v1` for backward compatibility.
 * Invalid/unsupported versions return a 400 Bad Request response with code `UNSUPPORTED_API_VERSION`.
 *
 * ## Lifecycle
 *
 * CURRENT   — fully supported, no deprecation warnings.
 * DEPRECATED — still works but adds `Deprecation` + `Sunset` headers.
 * RETIRED   — returns 410 Gone immediately.
 *
 * Issue #889 – API versioning strategy.
 * Issue #984 – API version negotiation.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Version registry ─────────────────────────────────────────────────────────

export type ApiVersion = "v1" | "v2";

type VersionStatus = "current" | "deprecated" | "retired";

interface VersionMeta {
  status: VersionStatus;
  /** ISO date after which the version is sunset. */
  sunsetDate?: string;
  /** Human-readable note added to the Deprecation-Notice header. */
  deprecationNote?: string;
}

const VERSION_REGISTRY: Record<ApiVersion, VersionMeta> = {
  v1: {
    status: "current",
  },
  v2: {
    status: "current",
  },
};

/** List of all supported API versions. */
export const SUPPORTED_VERSIONS: ApiVersion[] = Object.keys(VERSION_REGISTRY) as ApiVersion[];

/** The version served when no explicit version prefix is found in the URL. */
export const DEFAULT_VERSION: ApiVersion = "v1";

/** The latest stable version. Included in every response as `API-Version`. */
export const CURRENT_VERSION: ApiVersion = "v1";

// ── Version Negotiation ──────────────────────────────────────────────────────

export type VersionNegotiationResult =
  | { status: "success"; version: ApiVersion }
  | { status: "unsupported"; requestedVersion: string };

/**
 * negotiateVersion — extract and validate the requested API version.
 *
 * Resolution order:
 * 1. URL path prefix  → `/api/v1/…`, `/api/v2/…`
 * 2. Header `X-API-Version` or `Accept-Version`
 * 3. Query param `api-version` or `version`
 * 4. Fallback to DEFAULT_VERSION if no explicit version candidate is supplied.
 */
export function negotiateVersion(request: NextRequest): VersionNegotiationResult {
  const pathname = request.nextUrl.pathname;
  const pathMatch = pathname.match(/\/api\/(v\d+)(\/|$)/);
  const pathCandidate = pathMatch ? pathMatch[1] : null;

  const headerCandidate =
    request.headers.get("x-api-version") ?? request.headers.get("accept-version");

  const queryCandidate =
    request.nextUrl.searchParams.get("api-version") ??
    request.nextUrl.searchParams.get("version");

  const candidate = pathCandidate ?? headerCandidate ?? queryCandidate;

  if (!candidate) {
    return { status: "success", version: DEFAULT_VERSION };
  }

  if (candidate in VERSION_REGISTRY) {
    return { status: "success", version: candidate as ApiVersion };
  }

  return { status: "unsupported", requestedVersion: candidate };
}

/**
 * resolveVersion — infer the requested API version, falling back to DEFAULT_VERSION.
 */
export function resolveVersion(request: NextRequest): ApiVersion {
  const result = negotiateVersion(request);
  return result.status === "success" ? result.version : DEFAULT_VERSION;
}

// ── Response helpers ─────────────────────────────────────────────────────────

/**
 * rejectUnsupportedVersion — return a 400 Bad Request for unsupported API version requests.
 */
export function rejectUnsupportedVersion(
  negotiation: { status: "unsupported"; requestedVersion: string }
): NextResponse {
  return NextResponse.json(
    {
      data: null,
      error: `Unsupported API version '${negotiation.requestedVersion}'. Supported versions are: ${SUPPORTED_VERSIONS.join(", ")}.`,
      code: "UNSUPPORTED_API_VERSION",
      meta: {
        requestedVersion: negotiation.requestedVersion,
        supportedVersions: SUPPORTED_VERSIONS,
        latestVersion: CURRENT_VERSION,
      },
    },
    {
      status: 400,
      headers: {
        "API-Version": DEFAULT_VERSION,
        "X-API-Latest": CURRENT_VERSION,
      },
    }
  );
}

/**
 * addVersionHeaders — attach versioning metadata to an outgoing response.
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion
): NextResponse {
  const meta = VERSION_REGISTRY[version];

  response.headers.set("API-Version", version);
  response.headers.set("X-API-Latest", CURRENT_VERSION);

  if (meta && meta.status === "deprecated") {
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
 */
export function rejectRetiredVersion(version: ApiVersion): NextResponse | null {
  const meta = VERSION_REGISTRY[version];
  if (!meta || meta.status !== "retired") return null;

  return NextResponse.json(
    {
      data: null,
      error: `API version ${version} has been retired. Please migrate to ${CURRENT_VERSION}.`,
      code: "VERSION_RETIRED",
      meta: {
        migrateUrl: `/api/${CURRENT_VERSION}`,
      },
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
 * withVersioning — higher-order helper that negotiates the version, rejects
 * unsupported or retired versions, and attaches response headers.
 */
export async function withVersioning(
  request: NextRequest,
  handler: (version: ApiVersion) => NextResponse | Promise<NextResponse>
): Promise<NextResponse> {
  const negotiation = negotiateVersion(request);

  if (negotiation.status === "unsupported") {
    return rejectUnsupportedVersion(negotiation);
  }

  const version = negotiation.version;

  const gone = rejectRetiredVersion(version);
  if (gone) return gone;

  const response = await handler(version);
  return addVersionHeaders(response, version);
}
