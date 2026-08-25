/**
 * requestLogger.ts — Issue #894
 *
 * Server-side request/response logging middleware for Next.js API routes.
 *
 * Features:
 *   - Structured JSON log entries with request ID, method, path, status, duration
 *   - Automatic request ID generation / propagation (X-Request-ID header)
 *   - Response logging (status code, duration in ms)
 *   - Sensitive data redaction (Authorization, Cookie, password fields, tokens)
 *   - Forwarded to the existing `logger` utility (Sentry + optional drain URL)
 *
 * Usage (wrap a route handler):
 *
 *   import { withRequestLogging } from "@/app/api/requestLogger";
 *
 *   export const GET = withRequestLogging(async (req) => {
 *     // ... handler
 *   });
 *
 * Or imperatively in a handler:
 *
 *   import { logRequest } from "@/app/api/requestLogger";
 *
 *   export async function GET(req: NextRequest) {
 *     const { requestId, logResponse } = logRequest(req);
 *     const res = NextResponse.json({ ok: true });
 *     logResponse(res.status);
 *     return res;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/app/lib/logger";

// ─── Sensitive field redaction ────────────────────────────────────────────────

/** Headers whose values are always redacted. */
const REDACTED_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
]);

/** Body field names whose values are always redacted. */
const REDACTED_BODY_FIELDS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "secret",
  "privateKey",
  "secretKey",
  "accessToken",
  "refreshToken",
  "token",
  "apiKey",
  "encryptedKey",
  "mnemonic",
  "seedPhrase",
]);

function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = REDACTED_HEADERS.has(key.toLowerCase())
      ? "[REDACTED]"
      : value;
  });
  return out;
}

function redactBody(body: unknown): unknown {
  if (body === null || typeof body !== "object") return body;
  if (Array.isArray(body)) return body.map(redactBody);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key] = REDACTED_BODY_FIELDS.has(key) ? "[REDACTED]" : redactBody(value);
  }
  return out;
}

// ─── Log levels by status code ────────────────────────────────────────────────

function levelForStatus(status: number): "info" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

// ─── Core log entry shape ─────────────────────────────────────────────────────

export interface RequestLogEntry {
  requestId: string;
  method: string;
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  /** Status code — populated after the handler returns. */
  status?: number;
  /** Duration in milliseconds — populated after the handler returns. */
  durationMs?: number;
}

// ─── Imperative API ───────────────────────────────────────────────────────────

/**
 * Log an inbound request and return helpers to finalise the log entry.
 *
 * @returns requestId — Echo in the response X-Request-ID header.
 * @returns logResponse — Call with the status code once the handler finishes.
 */
export function logRequest(request: NextRequest): {
  requestId: string;
  logResponse: (status: number) => void;
} {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const startMs = Date.now();

  const { pathname, searchParams } = request.nextUrl;
  const query: Record<string, string> = {};
  searchParams.forEach((v, k) => (query[k] = v));

  const entry: RequestLogEntry = {
    requestId,
    method: request.method,
    path: pathname,
    ...(Object.keys(query).length ? { query } : {}),
  };

  logger.info("[request]", entry);

  return {
    requestId,
    logResponse(status: number) {
      const durationMs = Date.now() - startMs;
      const responseEntry = { ...entry, status, durationMs };
      const level = levelForStatus(status);
      logger[level]("[response]", responseEntry);
    },
  };
}

// ─── Higher-order wrapper ─────────────────────────────────────────────────────

type RouteHandler<C = unknown> = (
  request: NextRequest,
  context: C
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js route handler with automatic request/response logging.
 * Attaches X-Request-ID to the outbound response.
 *
 * @example
 * export const GET = withRequestLogging(async (req) => {
 *   return NextResponse.json({ ok: true });
 * });
 */
export function withRequestLogging<C = unknown>(
  handler: RouteHandler<C>
): RouteHandler<C> {
  return async (request: NextRequest, context: C) => {
    const { requestId, logResponse } = logRequest(request);

    let response: NextResponse;
    try {
      response = await handler(request, context);
    } catch (err) {
      logger.error("[request] Unhandled error in route handler", err);
      logResponse(500);
      throw err;
    }

    // Attach request ID to response so clients can correlate logs
    response.headers.set("x-request-id", requestId);
    logResponse(response.status);
    return response;
  };
}

// ─── Body logging helper (opt-in, dev only) ───────────────────────────────────

/**
 * Log a request body (redacted). Only active in non-production environments
 * to avoid emitting PII to production log drains.
 */
export async function logRequestBody(
  request: NextRequest,
  requestId: string
): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return;

  try {
    const cloned = request.clone();
    const raw = await cloned.json();
    logger.debug("[request:body]", { requestId, body: redactBody(raw) });
  } catch {
    // Body may already have been consumed — silently skip
  }
}
