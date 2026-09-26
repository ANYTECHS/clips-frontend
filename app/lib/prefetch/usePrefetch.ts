"use client";

/**
 * Hook for data prefetching
 * 
 * Manages prefetch lifecycle:
 * - Route-based: Prefetch on component mount for navigation routes
 * - Hover-based: Prefetch on mouse over for interactive elements
 * - Idle-time: Prefetch during requestIdleCallback
 * - Cancellation: Abort prefetch on navigation away
 * 
 * Integration with RequestCache for automatic deduplication
 * and stale-while-revalidate handling.
 */

import { useEffect, useRef, useCallback } from "react";
import { RequestCache } from "@/app/lib/cache/RequestCache";
import {
  getImmediatePrefetchEndpoints,
  getHoverPrefetchEndpoints,
  getIdlePrefetchEndpoints,
} from "./prefetchStrategies";

// Shared prefetch cache instance
const prefetchCache = new RequestCache({
  ttlMs: 60000, // 1 minute
  staleTtlMs: 300000, // 5 minutes
  maxEntries: 50,
});

/**
 * Hook for route-based prefetching
 * Call this in route layouts to prefetch data for that route
 */
export function usePrefetchRoute(route: string) {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Create abort controller for this prefetch session
    abortControllerRef.current = new AbortController();

    const controller = abortControllerRef.current;
    const endpoints = getImmediatePrefetchEndpoints(route);

    // Prefetch immediately for high-priority data
    endpoints.forEach((endpoint) => {
      if (endpoint && controller.signal.aborted === false) {
        prefetchEndpoint(endpoint, controller.signal).catch(() => {
          // Silently handle prefetch errors - not critical to app function
        });
      }
    });

    // Idle-time prefetch for lower-priority data
    if ("requestIdleCallback" in window) {
      const idleHandle = requestIdleCallback(() => {
        if (controller.signal.aborted === false) {
          const idleEndpoints = getIdlePrefetchEndpoints(route);
          idleEndpoints.forEach((endpoint) => {
            if (endpoint) {
              prefetchEndpoint(endpoint, controller.signal).catch(() => {
                // Silently handle prefetch errors
              });
            }
          });
        }
      });

      return () => {
        abortControllerRef.current?.abort();
        if ("cancelIdleCallback" in window) {
          cancelIdleCallback(idleHandle);
        }
      };
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [route]);
}

/**
 * Hook for hover-based prefetching
 * Call this on elements that link to other routes
 */
export function usePrefetchOnHover(
  selector: string,
  containerRef: React.RefObject<HTMLElement>
) {
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const handleMouseOver = useCallback(
    (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Extract identifier for this prefetch target
      const identifier = target.getAttribute("href") || target.id;
      if (!identifier) return;

      const endpoints = getHoverPrefetchEndpoints(selector);

      endpoints.forEach((endpoint) => {
        if (endpoint && !abortControllersRef.current.has(endpoint)) {
          const controller = new AbortController();
          abortControllersRef.current.set(endpoint, controller);

          prefetchEndpoint(endpoint, controller.signal).catch(() => {
            // Silently handle prefetch errors
          });
        }
      });
    },
    [selector]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseover", handleMouseOver);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      // Cleanup abort controllers on unmount
      abortControllersRef.current.forEach((controller) => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, [handleMouseOver, containerRef]);
}

/**
 * Internal function to prefetch an endpoint
 */
async function prefetchEndpoint(
  endpoint: string,
  abortSignal: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      signal: abortSignal,
      // Don't set credentials on cross-origin prefetch
      credentials: endpoint.startsWith("/") ? "same-origin" : "omit",
      // Low priority hint
      priority: "low" as any,
    });

    if (!response.ok) {
      throw new Error(`Prefetch failed: ${response.status}`);
    }

    // Cache the result for immediate use
    const data = await response.json();
    prefetchCache.set(endpoint, data);
  } catch (error) {
    // Prefetch errors are non-fatal - silently ignore
    if (error instanceof Error && error.name !== "AbortError") {
      console.debug(`Prefetch error for ${endpoint}:`, error.message);
    }
  }
}

/**
 * Access prefetched data from the prefetch cache
 * Returns data if already prefetched, otherwise returns null
 */
export function getPrefetchedData<T>(endpoint: string): T | null {
  const cached = prefetchCache.get(endpoint);
  return cached ? (cached.value as T) : null;
}

/**
 * Clear prefetch cache
 */
export function clearPrefetchCache(): void {
  prefetchCache.clear();
}
