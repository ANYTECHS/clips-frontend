// ─── Standard API response envelope ─────────────────────────────────────────
//
// All API routes must wrap their payload in one of these shapes so consumers
// have a single, predictable structure to parse.
//
// Success:   { data: T,    error: null,    meta?: ResponseMeta }
// Error:     { data: null, error: string,  code?: ErrorCode, meta?: ResponseMeta }
// Paginated: { data: T,    error: null,    meta: PaginationMeta & ResponseMeta }

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  /** Machine-readable error code — set on error responses only. */
  code?: ErrorCode;
  /** Optional metadata: pagination, request tracing, etc. */
  meta?: ResponseMeta;
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ResponseMeta extends Partial<PaginationMeta> {
  /** Echo of the inbound X-Request-ID header (or server-generated UUID). */
  requestId?: string;
  /** ISO-8601 timestamp of when the response was produced. */
  timestamp?: string;
}

// ─── Error codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  // Auth
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SESSION_EXPIRED"
  // Validation
  | "VALIDATION_ERROR"
  | "INVALID_INPUT"
  | "MISSING_REQUIRED_FIELD"
  // Resources
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "CONFLICT"
  // Rate limiting
  | "RATE_LIMITED"
  // Server
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  // Jobs / AI
  | "JOB_NOT_FOUND"
  | "JOB_FORBIDDEN"
  | "JOB_DISPATCH_FAILED"
  // Files / uploads
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "VIRUS_DETECTED"
  | "STORAGE_ERROR"
  // Blockchain
  | "WALLET_NOT_FOUND"
  | "MINT_FAILED"
  | "INSUFFICIENT_BALANCE";

// ─── Response builder helpers ─────────────────────────────────────────────────

/**
 * Build a successful response envelope.
 *
 * @example
 * return NextResponse.json(ok({ clips, total }));
 */
export function ok<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return { data, error: null, ...(meta ? { meta } : {}) };
}

/**
 * Build an error response envelope.
 *
 * @example
 * return NextResponse.json(err("Not found", "NOT_FOUND"), { status: 404 });
 */
export function err(message: string, code?: ErrorCode, meta?: ResponseMeta): ApiResponse<null> {
  return {
    data: null,
    error: message,
    ...(code ? { code } : {}),
    ...(meta ? { meta } : {}),
  };
}

/**
 * Compute pagination metadata from raw counts.
 *
 * @example
 * const meta = paginationMeta({ page: 2, pageSize: 20, total: 85 });
 * // { page: 2, pageSize: 20, total: 85, totalPages: 5, hasNextPage: true, hasPrevPage: true }
 */
export function paginationMeta(opts: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(opts.total / opts.pageSize));
  return {
    page: opts.page,
    pageSize: opts.pageSize,
    total: opts.total,
    totalPages,
    hasNextPage: opts.page < totalPages,
    hasPrevPage: opts.page > 1,
  };
}
