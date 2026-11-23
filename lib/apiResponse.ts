// Issue #1390 — shared API response helper.
//
// Every Next.js API route (app/api/**) answers errors with the same envelope:
//
//   { "error": "Bad Request", "message": "Missing url parameter.", "code": "MISSING_URL" }
//
//   - error:   short, stable label for the HTTP status (e.g. "Not Found")
//   - message: human-readable explanation, safe to show to the user
//   - code:    optional machine-readable reason (SCREAMING_SNAKE_CASE)
//
// Routes must build error responses with `apiError` (never hand-rolled
// `NextResponse.json({ error })` / plain strings). tests/api/error-envelope
// enforces this.
//
// Issue #1391 — every response built here carries the `x-request-id` header
// when a request ID is supplied, and 5xx errors are reported to Sentry tagged
// with that ID.

import { reportError } from "./errorReporting";
import { REQUEST_ID_HEADER } from "./requestId";

export interface ApiErrorBody {
  error: string;
  message: string;
  code?: string;
}

const STATUS_LABELS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? (status >= 500 ? "Internal Server Error" : "Error");
}

interface ApiResponseOptions {
  /** Request ID echoed in the `x-request-id` response header. */
  requestId?: string;
  headers?: HeadersInit;
}

function buildHeaders(options: ApiResponseOptions): Headers {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (options.requestId) headers.set(REQUEST_ID_HEADER, options.requestId);
  return headers;
}

/** JSON success response. */
export function apiJson<T>(
  data: T,
  options: ApiResponseOptions & { status?: number } = {},
): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: buildHeaders(options),
  });
}

/**
 * Standard error response: `{ error, message, code? }`.
 * 5xx responses are reported to Sentry (tagged with the request ID).
 */
export function apiError(
  status: number,
  message: string,
  options: ApiResponseOptions & { code?: string; cause?: unknown } = {},
): Response {
  const body: ApiErrorBody = { error: statusLabel(status), message };
  if (options.code) body.code = options.code;

  if (status >= 500) {
    reportError(options.cause ?? new Error(message), {
      requestId: options.requestId,
      tags: { status: String(status), ...(options.code ? { code: options.code } : {}) },
    });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: buildHeaders(options),
  });
}

/** Runtime check for the standard error envelope. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.error !== "string" || v.error.length === 0) return false;
  if (typeof v.message !== "string" || v.message.length === 0) return false;
  if ("code" in v && v.code !== undefined && typeof v.code !== "string") return false;
  return true;
}

/** Client helper: best human-readable message from an API error body. */
export function getApiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const v = body as Record<string, unknown>;
    if (typeof v.message === "string" && v.message) return v.message;
    if (typeof v.error === "string" && v.error) return v.error;
  }
  return fallback;
}
