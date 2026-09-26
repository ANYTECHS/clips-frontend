/**
 * apiResponse.ts — Issue #891
 *
 * Centralised response factories for Next.js API Route handlers.
 *
 * Every handler should import from here rather than constructing
 * NextResponse.json payloads by hand so the shape is always consistent.
 *
 * @example
 * import { success, notFound, unauthorized, validationError } from "@/app/api/apiResponse";
 *
 * export async function GET(req: NextRequest) {
 *   const session = await auth();
 *   if (!session) return unauthorized();
 *   const item = await db.find(id);
 *   if (!item) return notFound("Item not found");
 *   return success({ item });
 * }
 */

import { NextResponse } from "next/server";
import type { ApiResponse, ErrorCode, ResponseMeta } from "./types";
import { ok, err, paginationMeta } from "./types";
// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMeta(extra?: Partial<ResponseMeta>): ResponseMeta {
  return {
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return "data" in body && "error" in body &&
    (body.error === null || typeof body.error === "string");
}

/**
 * Normalize a JSON response to the API envelope while preserving its status
 * and headers. Empty and non-JSON responses are returned unchanged.
 */
export async function transformResponse(
  response: NextResponse,
  meta?: Partial<ResponseMeta>
): Promise<NextResponse> {
  if (response.status === 204 || !response.headers.get("content-type")?.includes("application/json")) {
    return response;
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }

  const transformed = isApiResponse(body)
    ? { ...body, meta: { ...buildMeta(meta), ...(body.meta ?? {}) } }
    : body && typeof body === "object" && "error" in body
      ? {
          ...err(String((body as { error: unknown }).error),
            (body as { code?: ErrorCode }).code, buildMeta(meta)),
          ...("detail" in body ? { detail: (body as { detail: unknown }).detail } : {}),
        }
      : ok(body, buildMeta(meta));

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return NextResponse.json(transformed, { status: response.status, headers });
}

// ─── Success responses ────────────────────────────────────────────────────────

/** 200 OK with data payload. */
export function success<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(ok(data, buildMeta(meta)));
}

/** 201 Created with data payload. */
export function created<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(ok(data, buildMeta(meta)), { status: 201 });
}

/** 204 No Content — use when no body is needed. */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ─── Paginated success ────────────────────────────────────────────────────────

/**
 * 200 OK with paginated data.
 *
 * @example
 * return paginated(clips, { page, pageSize, total });
 */
export function paginated<T>(
  data: T,
  opts: { page: number; pageSize: number; total: number },
  extra?: Partial<ResponseMeta>
): NextResponse<ApiResponse<T>> {
  const meta: ResponseMeta = {
    ...buildMeta(extra),
    ...paginationMeta(opts),
  };
  return NextResponse.json(ok(data, meta));
}

// ─── Client error responses ───────────────────────────────────────────────────

/** 400 Bad Request — generic validation failure. */
export function badRequest(
  message = "Bad request",
  code: ErrorCode = "INVALID_INPUT"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, code, buildMeta()), { status: 400 });
}

/** 400 with structured validation issues from Zod or similar. */
export function validationError(
  issues: unknown[],
  message = "Validation failed"
): NextResponse<ApiResponse<null> & { issues: unknown[] }> {
  const body = {
    ...err(message, "VALIDATION_ERROR", buildMeta()),
    issues,
  };
  return NextResponse.json(body, { status: 400 });
}

/** 401 Unauthorized. */
export function unauthorized(
  message = "Unauthorized"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, "UNAUTHORIZED", buildMeta()), { status: 401 });
}

/** 403 Forbidden. */
export function forbidden(
  message = "Forbidden"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, "FORBIDDEN", buildMeta()), { status: 403 });
}

/** 404 Not Found. */
export function notFound(
  message = "Not found"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, "NOT_FOUND", buildMeta()), { status: 404 });
}

/** 409 Conflict. */
export function conflict(
  message = "Conflict",
  code: ErrorCode = "CONFLICT"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, code, buildMeta()), { status: 409 });
}

/** 429 Too Many Requests. */
export function rateLimited(
  retryAfterSeconds = 60
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err("Too many requests", "RATE_LIMITED", buildMeta()), {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

// ─── Server error responses ───────────────────────────────────────────────────

/** 500 Internal Server Error. */
export function internalError(
  message = "Internal server error",
  code: ErrorCode = "INTERNAL_ERROR"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, code, buildMeta()), { status: 500 });
}

/** 503 Service Unavailable. */
export function serviceUnavailable(
  message = "Service temporarily unavailable"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, "SERVICE_UNAVAILABLE", buildMeta()), { status: 503 });
}

/** 504 Gateway Timeout. */
export function timeout(
  message = "Request timed out"
): NextResponse<ApiResponse<null>> {
  return NextResponse.json(err(message, "TIMEOUT", buildMeta()), {
    status: 504,
    headers: { "Retry-After": "1" },
  });
}

// ─── Request ID ───────────────────────────────────────────────────────────────

/**
 * Extract or generate a request ID.
 * Checks X-Request-ID header first; falls back to a new UUID v4.
 */
export function getRequestId(headers: Headers): string {
  return headers.get("x-request-id") ?? crypto.randomUUID();
}
