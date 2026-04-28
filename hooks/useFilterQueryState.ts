"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Custom hook for managing filter state in URL query parameters.
 * Provides a single source of truth for filter state that persists across
 * navigation, page reloads, and enables shareable URLs.
 * 
 * @template T - The shape of the filter state object
 * @param defaultValues - Default values for filters when no query params exist
 * @returns Object with current filter state and update function
 * 
 * @example
 * const { filters, updateFilters } = useFilterQueryState({
 *   style: "All Styles",
 *   virality: ["high", "medium", "low"],
 *   vault: "pending"
 * });
 */
export function useFilterQueryState<T extends Record<string, any>>(
  defaultValues: T
): {
  filters: T;
  updateFilters: (updates: Partial<T>) => void;
  resetFilters: () => void;
} {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Parse current URL query params into filter state.
   * Falls back to default values for missing or invalid params.
   */
  const filters = useMemo(() => {
    const result = { ...defaultValues };

    Object.keys(defaultValues).forEach((key) => {
      const paramValue = searchParams.get(key);
      
      if (paramValue === null) {
        // No param in URL, use default
        return;
      }

      const defaultValue = defaultValues[key];

      // Handle array values (e.g., virality levels)
      if (Array.isArray(defaultValue)) {
        try {
          const parsed = JSON.parse(paramValue);
          if (Array.isArray(parsed)) {
            result[key] = parsed as any;
          }
        } catch {
          // Invalid JSON, try comma-separated
          result[key] = paramValue.split(",").filter(Boolean) as any;
        }
      }
      // Handle string values
      else if (typeof defaultValue === "string") {
        result[key] = paramValue as any;
      }
      // Handle number values
      else if (typeof defaultValue === "number") {
        const parsed = Number(paramValue);
        if (!isNaN(parsed)) {
          result[key] = parsed as any;
        }
      }
      // Handle boolean values
      else if (typeof defaultValue === "boolean") {
        result[key] = (paramValue === "true") as any;
      }
    });

    return result as T;
  }, [searchParams, defaultValues]);

  /**
   * Update filter state and sync to URL query params.
   * Uses client-side navigation to avoid page reload.
   */
  const updateFilters = useCallback(
    (updates: Partial<T>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        const defaultValue = defaultValues[key];

        // Remove param if value matches default (keep URL clean)
        if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
          newParams.delete(key);
          return;
        }

        // Serialize value to string for URL
        if (Array.isArray(value)) {
          if (value.length === 0) {
            newParams.delete(key);
          } else {
            // Use comma-separated for better readability
            newParams.set(key, value.join(","));
          }
        } else if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });

      // Update URL without page reload
      const queryString = newParams.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      
      router.push(newUrl, { scroll: false });
    },
    [searchParams, pathname, router, defaultValues]
  );

  /**
   * Reset all filters to default values and clear URL params.
   */
  const resetFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  return {
    filters,
    updateFilters,
    resetFilters,
  };
}
