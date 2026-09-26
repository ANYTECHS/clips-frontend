import type { PaginationMeta } from "./types";
import { paginationMeta } from "./types";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type PaginationParams = {
  page: number;
  pageSize: number;
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  maxPageSize = MAX_PAGE_SIZE
): PaginationParams {
  const safeMaxPageSize =
    Number.isSafeInteger(maxPageSize) && maxPageSize > 0
      ? Math.min(maxPageSize, MAX_PAGE_SIZE)
      : MAX_PAGE_SIZE;
  const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
  const requestedPageSize = parsePositiveInteger(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(safeMaxPageSize, requestedPageSize);

  return { page, pageSize };
}

export function paginateItems<T>(
  items: T[],
  params: PaginationParams
): { items: T[]; meta: PaginationMeta } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, totalPages);
  const start = (page - 1) * params.pageSize;

  return {
    items: items.slice(start, start + params.pageSize),
    meta: paginationMeta({ page, pageSize: params.pageSize, total }),
  };
}
