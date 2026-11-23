import { codeForStatus, type ErrorCode } from "./errorCodes";

/**
 * An expected, client-facing failure. Throw it from a route handler (or a
 * helper it calls) and convert it with `handleError()` from ./apiResponse —
 * the status, code and details are returned to the client as-is.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code: ErrorCode = codeForStatus(status),
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface SentryLike {
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => unknown;
}

/**
 * Reports an unexpected error. The full error (stack included) is always
 * written to the server log, and forwarded to Sentry when the Sentry SDK has
 * been initialised for this runtime (it registers itself on `globalThis`).
 */
export function reportError(error: unknown, context?: string): void {
  console.error(`[api]${context ? ` ${context}` : ""} unhandled error:`, error);
  const sentry = (globalThis as { Sentry?: SentryLike }).Sentry;
  try {
    sentry?.captureException(error, context ? { extra: { context } } : undefined);
  } catch {
    // Never let error reporting break the response.
  }
}
