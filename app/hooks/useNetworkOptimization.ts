/**
 * Network Optimization Hook (#877)
 *
 * Provides network-aware request handling with automatic:
 * - Request batching
 * - Priority-based scheduling
 * - Compression negotiation
 * - Adaptive caching based on network conditions
 */

import { useEffect, useState, useCallback } from "react";
import {
  getNetworkInfo,
  watchNetworkChanges,
  isSlowNetwork,
  type NetworkInfo,
} from "@/app/lib/networkOptimization";
import { requestCache } from "@/app/lib/cache/requestCacheInstance";
import type { RequestPriority } from "@/app/lib/cache/RequestCache";

export interface UseNetworkOptimizationOptions {
  /** Enable network condition monitoring */
  monitorNetworkChanges?: boolean;
  /** Callback when network conditions change */
  onNetworkChange?: (info: NetworkInfo) => void;
}

/**
 * Hook that provides network-aware optimization utilities and current network state.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { networkInfo, isSlow, optimizedFetch } = useNetworkOptimization({
 *     monitorNetworkChanges: true,
 *     onNetworkChange: (info) => {
 *       console.log('Network changed:', info.effectiveType);
 *     }
 *   });
 * 
 *   const loadData = useCallback(async () => {
 *     const data = await optimizedFetch('/api/data', {
 *       priority: 'high',
 *       contentType: 'data'
 *     });
 *     return data;
 *   }, [optimizedFetch]);
 * 
 *   return (
 *     <div>
 *       {isSlow && <p>Slow network detected - loading optimized content</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNetworkOptimization(options: UseNetworkOptimizationOptions = {}) {
  const { monitorNetworkChanges = true, onNetworkChange } = options;
  
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(() => getNetworkInfo());
  const [isSlow, setIsSlow] = useState<boolean>(() => isSlowNetwork());

  useEffect(() => {
    if (!monitorNetworkChanges) return;

    const cleanup = watchNetworkChanges((info) => {
      setNetworkInfo(info);
      setIsSlow(isSlowNetwork());
      onNetworkChange?.(info);
    });

    return cleanup;
  }, [monitorNetworkChanges, onNetworkChange]);

  /**
   * Optimized fetch that uses RequestCache with network-aware settings.
   */
  const optimizedFetch = useCallback(
    async <T = any>(
      url: string,
      options: {
        priority?: RequestPriority;
        contentType?: "image" | "data" | "analytics" | "background";
        ttl?: number;
        init?: RequestInit;
      } = {}
    ): Promise<T> => {
      const { priority = "normal", contentType, ttl, init } = options;

      // Adjust priority based on network conditions
      let finalPriority = priority;
      if (isSlow) {
        if (priority === "normal") finalPriority = "low";
        if (contentType === "analytics" || contentType === "background") {
          finalPriority = "low";
        }
      }

      return requestCache.fetch<T>(
        url,
        async () => {
          const response = await fetch(url, {
            ...init,
            headers: {
              "Accept-Encoding": "br, gzip, deflate",
              ...init?.headers,
            },
          });

          if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
          }

          return response.json();
        },
        {
          priority: finalPriority,
          ttl: ttl,
        }
      );
    },
    [isSlow]
  );

  return {
    /** Current network information */
    networkInfo,
    /** Whether the network is considered slow */
    isSlow,
    /** Optimized fetch function with automatic network adaptation */
    optimizedFetch,
  };
}
