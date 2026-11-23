import { NextResponse } from "next/server";
import { ApiError, reportError } from "./apiError";
import { ERROR_CODES, codeForStatus, type ErrorCode } from "./errorCodes";

// Standard JSON responses for every API route (issue #1249).
//
// Route handlers must build JSON responses through these helpers rather than
// calling `NextResponse.json` directly (enforced by ESLint and by
// tests/api/noDirectNextResponseJson.test.ts). Every error has the shape:
//
//   { error: string, message: string, code?: string, details?: object }
//
// `error` is the HTTP reason phrase, `message` is a human-readable description
// that is safe to show to users, `code` is a machine-readable value from
// ./errorCodes and `details` carries structured data such as field errors.
// See docs/API.md and docs/openapi.yaml.

export interface ApiErrorBody {
  error: string;
  message: string;
  code?: ErrorCode;
  details?: Record<string, unknown>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedBody<T> {
  items: T[];
  pagination: Pagination & { totalPages: number };
}

interface ResponseOptions {
  headers?: HeadersInit;
}

interface ErrorOptions extends ResponseOptions {
  details?: Record<string, unknown>;
}

const STATUS_TEXT: Record<number, string> = {
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

function statusText(status: number): string {
  return STATUS_TEXT[status] ?? (status >= 500 ? "Server Error" : "Error");
}

/** JSON success response. */
export function success<T>(data: T, status = 200, options: ResponseOptions = {}) {
  return NextResponse.json(data, { status, headers: options.headers });
}

/** JSON error response in the standard error shape. */
export function error(
  message: string,
  status: number,
  code: ErrorCode = codeForStatus(status),
  options: ErrorOptions = {}
) {
  const body: ApiErrorBody = { error: statusText(status), message, code };
  if (options.details) body.details = options.details;
  return NextResponse.json(body, { status, headers: options.headers });
}

/** JSON list response with pagination metadata. */
export function paginated<T>(items: T[], pagination: Pagination, options: ResponseOptions = {}) {
  const totalPages =
    pagination.limit > 0 ? Math.ceil(pagination.total / pagination.limit) : 0;
  const body: PaginatedBody<T> = { items, pagination: { ...pagination, totalPages } };
  return NextResponse.json(body, { status: 200, headers: options.headers });
}

/** 400 response listing field-level validation errors in `details`. */
export function validationError(
  fields: Record<string, string | string[]>,
  message = "Request validation failed."
) {
  return error(message, 400, ERROR_CODES.VALIDATION_ERROR, { details: { fields } });
}

/**
 * 500 response for unhandled exceptions. The full error is logged and sent to
 * Sentry; the client only receives a generic message.
 */
export function serverError(
  err: unknown,
  context?: string,
  message = "An unexpected error occurred. Please try again."
) {
  reportError(err, context);
  return error(message, 500, ERROR_CODES.INTERNAL_ERROR);
}

/**
 * Converts anything thrown inside a route handler into a response: an
 * `ApiError` keeps its status/code/details, everything else becomes a 500.
 */
export function handleError(err: unknown, context?: string) {
  if (err instanceof ApiError) {
    return error(err.message, err.status, err.code, { details: err.details });
  }
  return serverError(err, context);
}

/** Response without a body (e.g. 200 acknowledgements, 304 Not Modified). */
export function empty(status = 204, options: ResponseOptions = {}) {
  return new NextResponse(null, { status, headers: options.headers });
}
