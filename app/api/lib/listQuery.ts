/**
 * app/api/lib/listQuery.ts
 *
 * Shared filtering, sorting and pagination for list endpoints (Issue #949).
 *
 * # Why this is centralised
 *
 * Each list endpoint had grown its own conventions. `/api/clips` read `page` +
 * `pageSize` and sorted implicitly by insertion order; other routes used
 * different parameter names, and none of them accepted a sort direction at
 * all. A client could not carry a working query from one endpoint to another,
 * and every new endpoint reinvented the parsing — usually without validating
 * it.
 *
 * The rules this fixes on:
 *
 * - **Pagination** is `page` (1-based) and `pageSize`, capped.
 * - **Sorting** is `sort=<field>` and `order=asc|desc`.
 * - **Filtering** is one query parameter per field, with `,` separating
 *   values for the multi-value ones.
 * - **Ranges** are `<field>Min` / `<field>Max` for numbers, `dateFrom` /
 *   `dateTo` for dates.
 * - **Free text** is `q`.
 *
 * # Why sort fields are an allow-list
 *
 * `sort` names a property that gets read off every record. Taking it straight
 * from the query string means a caller picks which field the server touches,
 * which leaks the shape of the record through timing and error behaviour and,
 * on a database-backed store, is one refactor away from being injectable.
 * `createListQuerySchema` requires the caller to name the sortable fields, so
 * an unknown one is a 400 rather than a silent `undefined` comparison that
 * returns the list in arbitrary order.
 */

import { z } from "zod";

/** Upper bound on `pageSize`, whatever a caller asks for. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export type SortOrder = "asc" | "desc";

/**
 * Splits a comma-separated query parameter into trimmed, non-empty values.
 *
 * Exported because routes with bespoke parsing needs should still split the
 * same way — `?tags=a,,b` meaning `["a", "b"]` rather than `["a", "", "b"]` is
 * the kind of detail that silently diverges between endpoints.
 */
export function splitCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Coerces a query-string integer, returning `undefined` for absent/invalid. */
const optionalInt = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .refine((v) => v === undefined || !Number.isNaN(v), {
    message: "Expected a number",
  });

/**
 * ISO date (or any `Date`-parseable string), normalised to an ISO string.
 *
 * Kept as a string rather than a `Date` so the result stays JSON-serialisable
 * and comparisons against stored ISO timestamps are plain string compares.
 */
const optionalDate = z
  .string()
  .optional()
  .transform((v) => {
    if (v === undefined || v.trim() === "") return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  })
  .refine((v) => v !== null, { message: "Expected an ISO 8601 date" });

/**
 * Builds the query schema for a list endpoint.
 *
 * @param sortableFields fields `sort` may name. The first is the default.
 * @param defaultOrder direction used when `order` is absent.
 */
export function createListQuerySchema<const T extends readonly [string, ...string[]]>(
  sortableFields: T,
  defaultOrder: SortOrder = "desc",
) {
  return z.object({
    page: z
      .string()
      .optional()
      .transform((v) => {
        const n = v === undefined || v.trim() === "" ? 1 : Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : NaN;
      })
      .refine((n) => !Number.isNaN(n) && n >= 1, {
        message: "page must be an integer >= 1",
      }),

    pageSize: z
      .string()
      .optional()
      .transform((v) => {
        const n =
          v === undefined || v.trim() === "" ? DEFAULT_PAGE_SIZE : Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : NaN;
      })
      .refine((n) => !Number.isNaN(n) && n >= 1 && n <= MAX_PAGE_SIZE, {
        message: `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`,
      }),

    // Rejecting an unknown sort field rather than ignoring it: a client that
    // misspells `createdAt` should be told, not handed an arbitrarily ordered
    // page it will render as if it were sorted.
    sort: z.enum(sortableFields).optional().default(sortableFields[0]),
    order: z.enum(["asc", "desc"]).optional().default(defaultOrder),

    q: z.string().optional().default(""),
    dateFrom: optionalDate,
    dateTo: optionalDate,
  });
}

export type ListQuery = {
  page: number;
  pageSize: number;
  sort: string;
  order: SortOrder;
  q: string;
  dateFrom?: string;
  dateTo?: string;
};

/** A numeric `<field>Min` / `<field>Max` range filter. */
export const rangeSchema = z.object({
  min: optionalInt,
  max: optionalInt,
});

/**
 * Reads `<prefix>Min` / `<prefix>Max` out of a query string.
 *
 * Returns `{ ok: false }` when either bound is unparseable, or when they are
 * inverted. An inverted range is always a client mistake — it can only ever
 * match nothing — so reporting it beats returning an empty list the caller
 * will read as "no results".
 */
export function parseRange(
  params: URLSearchParams,
  prefix: string,
):
  | { ok: true; min?: number; max?: number }
  | { ok: false; error: string } {
  const parsed = rangeSchema.safeParse({
    min: params.get(`${prefix}Min`) ?? undefined,
    max: params.get(`${prefix}Max`) ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: `${prefix}Min/${prefix}Max must be numbers` };
  }

  const { min, max } = parsed.data;
  if (min !== undefined && max !== undefined && min > max) {
    return { ok: false, error: `${prefix}Min must not exceed ${prefix}Max` };
  }

  return { ok: true, min, max };
}

/**
 * Sorts `items` by `field`, ascending or descending.
 *
 * Returns a new array — sorting in place would mutate a store's own array and
 * leave the next caller reading it in whatever order the last request asked
 * for.
 *
 * `null` and `undefined` sort last in both directions. Treating "no value" as
 * smaller than everything would put empty records at the top of an ascending
 * list, which is never what a user browsing a list wants to see first.
 */
export function applySort<T extends Record<string, unknown>>(
  items: readonly T[],
  field: string,
  order: SortOrder,
): T[] {
  const direction = order === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    const left = a[field];
    const right = b[field];

    const leftMissing = left === null || left === undefined;
    const rightMissing = right === null || right === undefined;
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;

    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * direction;
    }

    if (typeof left === "boolean" && typeof right === "boolean") {
      return (Number(left) - Number(right)) * direction;
    }

    // Everything else compares as a string. ISO timestamps sort correctly
    // lexicographically, which is why dates are kept as ISO strings rather
    // than being parsed per comparison.
    return String(left).localeCompare(String(right)) * direction;
  });
}

/** One page of results plus the total before pagination. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Slices one page out of `items`.
 *
 * `total` is the length before slicing, so a client can render "showing 21–40
 * of 137" without a second request.
 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): Paginated<T> {
  const total = items.length;
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Case-insensitive substring match across the named fields.
 *
 * Substring rather than token or prefix matching because the fields this runs
 * over are short human-entered labels — clip titles, transaction descriptions
 * — where a user typing "sunset" expects to find "Golden sunset b-roll".
 */
export function matchesQuery<T extends Record<string, unknown>>(
  item: T,
  q: string,
  fields: readonly string[],
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();

  return fields.some((field) => {
    const value = item[field];
    if (typeof value === "string") {
      return value.toLowerCase().includes(needle);
    }
    if (Array.isArray(value)) {
      return value.some(
        (entry) => typeof entry === "string" && entry.toLowerCase().includes(needle),
      );
    }
    return false;
  });
}

/**
 * Inclusive ISO date-range filter on `field`.
 *
 * Both bounds are inclusive: a user asking for `dateTo=2026-03-31` means "up
 * to and including the 31st". `dateTo` is compared against the date portion
 * only, so a record stamped `2026-03-31T14:00:00Z` is not excluded by a bound
 * that normalises to midnight.
 */
export function withinDateRange(
  value: unknown,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) return true;
  if (typeof value !== "string") return false;

  const day = value.slice(0, 10);

  if (dateFrom && day < dateFrom.slice(0, 10)) return false;
  if (dateTo && day > dateTo.slice(0, 10)) return false;

  return true;
}

/** Inclusive numeric range filter. */
export function withinRange(
  value: unknown,
  min?: number,
  max?: number,
): boolean {
  if (min === undefined && max === undefined) return true;
  if (typeof value !== "number") return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Matches when the record's value is one of `allowed`.
 *
 * An empty `allowed` means "no filter", not "match nothing" — an absent query
 * parameter must not silently empty the list.
 */
export function matchesAny(value: unknown, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true;
  return typeof value === "string" && allowed.includes(value);
}

/**
 * Matches when the record's array contains every one of `required`.
 *
 * AND rather than OR: tags narrow. Someone filtering by `travel,timelapse`
 * wants clips that are both, and OR would widen the list as they added tags —
 * the opposite of what a filter control implies.
 */
export function containsAll(value: unknown, required: readonly string[]): boolean {
  if (required.length === 0) return true;
  if (!Array.isArray(value)) return false;

  const present = new Set(
    value.filter((v): v is string => typeof v === "string").map((v) => v.toLowerCase()),
  );
  return required.every((r) => present.has(r.toLowerCase()));
}
