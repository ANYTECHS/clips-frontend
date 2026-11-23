/**
 * Issue #1248 — standardized cursor-based pagination for list endpoints.
 *
 * Every list endpoint (`GET /api/jobs`, `GET /api/clips`,
 * `GET /api/wallet/transactions`, `GET /api/notifications`) shares:
 *
 *   - query params: `cursor` (opaque, optional) and `limit` (default 20, max 100)
 *   - response body: `{ data: [...], pagination: { nextCursor, hasMore, total? } }`
 *   - an invalid cursor → `400 { error: "Invalid cursor", message }`
 *
 * Cursors are opaque base64url strings that encode the sort-field value and
 * the ID of the last item on the page (keyset pagination), so the next page
 * is stable even when rows are inserted ahead of the cursor.
 *
 * This module is framework-agnostic (no Next.js imports) so it can be unit
 * tested in Node and reused by route handlers and the API client alike.
 */

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type SortValue = string | number;

/** Decoded contents of a cursor: sort-field value + ID of the last item. */
export interface CursorPayload {
  /** Value of the sort field of the last item on the previous page. */
  v: SortValue;
  /** ID of the last item on the previous page (tie-breaker). */
  id: string | number;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface PaginateResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Thrown when a client sends a cursor that cannot be decoded. */
export class InvalidCursorError extends Error {
  readonly status = 400;
  constructor(message = "The `cursor` parameter is malformed or has expired.") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

/* ------------------------------------------------------------------ */
/* base64url helpers (work in Node and the browser/edge runtime)       */
/* ------------------------------------------------------------------ */

function toBase64Url(input: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(input, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(input)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) {
    throw new InvalidCursorError();
  }
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return typeof Buffer !== "undefined"
    ? Buffer.from(padded, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(padded)));
}

/* ------------------------------------------------------------------ */
/* Cursor encoding                                                     */
/* ------------------------------------------------------------------ */

export function encodeCursor(payload: CursorPayload): string {
  return toBase64Url(JSON.stringify({ v: payload.v, id: payload.id }));
}

export function decodeCursor(cursor: string): CursorPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(cursor));
  } catch {
    throw new InvalidCursorError();
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("v" in parsed) ||
    !("id" in parsed)
  ) {
    throw new InvalidCursorError();
  }
  const { v, id } = parsed as Record<string, unknown>;
  const validV = typeof v === "string" || (typeof v === "number" && Number.isFinite(v));
  const validId = typeof id === "string" || (typeof id === "number" && Number.isFinite(id));
  if (!validV || !validId) {
    throw new InvalidCursorError();
  }
  return { v: v as SortValue, id: id as string | number };
}

/* ------------------------------------------------------------------ */
/* Query param parsing                                                 */
/* ------------------------------------------------------------------ */

/** Clamps `limit` to `[1, MAX_LIMIT]`, falling back to `DEFAULT_LIMIT`. */
export function clampLimit(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return DEFAULT_LIMIT;
  const n = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export interface PaginationParams {
  cursor: CursorPayload | null;
  /** The raw cursor string as sent by the client (for forwarding). */
  rawCursor: string | null;
  limit: number;
}

/**
 * Reads `cursor` and `limit` from URL search params.
 * Throws `InvalidCursorError` when the cursor is present but malformed.
 */
export function parsePaginationParams(params: URLSearchParams): PaginationParams {
  const rawCursor = params.get("cursor");
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  return { cursor, rawCursor: rawCursor || null, limit: clampLimit(params.get("limit")) };
}

/* ------------------------------------------------------------------ */
/* paginate()                                                          */
/* ------------------------------------------------------------------ */

export interface PaginateOptions<T> {
  /** Sort field to key the cursor on. Defaults to `createdAt`. */
  sortField?: keyof T & string;
  /** ID field used as tie-breaker. Defaults to `id`. */
  idField?: keyof T & string;
  /** Sort direction of `query`. Defaults to `desc` (newest first). */
  direction?: "asc" | "desc";
}

function toComparable(value: unknown): SortValue {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // ISO timestamps compare correctly as numbers; plain strings compare lexically.
    const ts = Date.parse(value);
    return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(ts) ? ts : value;
  }
  return String(value ?? "");
}

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * Keyset-paginates `query` (an already-sorted array) starting after `cursor`.
 *
 * `cursor` may be the opaque string from the client or `null` for the first
 * page. Returns `{ items, nextCursor, hasMore }`; `nextCursor` is `null` on
 * the last page.
 */
export function paginate<T extends Record<string, unknown>>(
  query: readonly T[],
  cursor: string | null | undefined,
  limit: number | string | null | undefined,
  options: PaginateOptions<T> = {},
): PaginateResult<T> {
  const sortField = (options.sortField ?? "createdAt") as string;
  const idField = (options.idField ?? "id") as string;
  const dir = options.direction === "asc" ? 1 : -1;
  const size = clampLimit(limit);

  let start = 0;
  if (cursor) {
    const { v, id } = decodeCursor(cursor);
    const cv = toComparable(v);
    // First index strictly "after" the cursor in sort order.
    start = query.findIndex((item) => {
      const byField = compare(toComparable(item[sortField]), cv) * dir;
      if (byField !== 0) return byField > 0;
      return compare(toComparable(item[idField]), toComparable(id)) * dir > 0;
    });
    if (start === -1) start = query.length;
  }

  const items = query.slice(start, start + size);
  const hasMore = start + size < query.length;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          v: toComparable(last[sortField]),
          id: (last[idField] as string | number) ?? "",
        })
      : null;

  return { items, nextCursor, hasMore };
}

/** Wraps a page in the standard response envelope. */
export function toPaginatedResponse<T>(
  page: PaginateResult<T>,
  total?: number,
): PaginatedResponse<T> {
  const pagination: PaginationMeta = { nextCursor: page.nextCursor, hasMore: page.hasMore };
  if (typeof total === "number") pagination.total = total;
  return { data: page.items, pagination };
}

/* ------------------------------------------------------------------ */
/* List endpoint registry (used by the API proxy)                      */
/* ------------------------------------------------------------------ */

/** Collection endpoints that must follow the standard pagination contract. */
export const PAGINATED_LIST_ENDPOINTS = [
  "/jobs",
  "/clips",
  "/wallet/transactions",
  "/notifications",
] as const;

/** True when `path` (optionally `/api/v1`-prefixed) is a paginated list endpoint. */
export function isPaginatedListPath(path: string): boolean {
  const normalized = path.replace(/^\/api\/v\d+/, "").replace(/\/+$/, "");
  return (PAGINATED_LIST_ENDPOINTS as readonly string[]).includes(normalized);
}

/**
 * Validates `cursor` and applies the default / clamped `limit` to a list
 * request's query string. Throws `InvalidCursorError` for a bad cursor.
 */
export function normalizeListSearchParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const { rawCursor, limit } = parsePaginationParams(params);
  if (rawCursor) next.set("cursor", rawCursor);
  else next.delete("cursor");
  next.set("limit", String(limit));
  return next;
}

/** Standard 400 body for an invalid cursor. */
export function invalidCursorBody(err: InvalidCursorError) {
  return { error: "Invalid cursor", message: err.message, statusCode: 400 };
}
