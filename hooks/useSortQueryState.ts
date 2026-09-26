"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState {
  field: string;
  direction: SortDirection;
}

/**
 * Custom hook for managing sort state in URL query parameters.
 * Provides a single source of truth for sort state that persists across
 * navigation, page reloads, and enables shareable URLs.
 *
 * @param defaultField - Default sort field name
 * @param defaultDirection - Default sort direction (default: "desc")
 * @returns Object with current sort state and update function
 *
 * @example
 * const { sort, setSort } = useSortQueryState("createdAt", "desc");
 * // sort = { field: "createdAt", direction: "desc" }
 * // setSort("score", "asc") updates URL to ?sort=score&dir=asc
 */
export function useSortQueryState(
  defaultField: string,
  defaultDirection: SortDirection = "desc"
): {
  sort: SortState;
  setSort: (field: string, direction?: SortDirection) => void;
  toggleSort: (field: string) => void;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const sort = useMemo((): SortState => {
    const field = searchParams.get("sort") || defaultField;
    const dir = searchParams.get("dir");
    const direction: SortDirection = dir === "asc" || dir === "desc" ? dir : defaultDirection;
    return { field, direction };
  }, [searchParams, defaultField, defaultDirection]);

  const setSort = useCallback(
    (field: string, direction?: SortDirection) => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set("sort", field);
      newParams.set("dir", direction ?? defaultDirection);
      router.push(`${pathname}?${newParams.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router, defaultDirection]
  );

  const toggleSort = useCallback(
    (field: string) => {
      if (sort.field === field) {
        setSort(field, sort.direction === "asc" ? "desc" : "asc");
      } else {
        setSort(field, "desc");
      }
    },
    [sort, setSort]
  );

  return { sort, setSort, toggleSort };
}
