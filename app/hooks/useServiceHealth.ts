"use client";

/**
 * useServiceHealth
 *
 * Polls /api/health/circuit-breakers at a configurable interval and returns
 * the current degradation state of each external service.
 *
 * The hook is intentionally lightweight:
 *  - First fetch is fired on mount (no initial render delay).
 *  - Subsequent fetches run on the interval.
 *  - A failed fetch is logged but does not crash the component tree; the
 *    last known good state is preserved until the next successful poll.
 *  - The interval is paused when the document is hidden (tab backgrounded)
 *    and resumed on visibility change to avoid unnecessary wake-ups.
 *
 * Usage:
 * ```tsx
 * const { degraded, services, loading } = useServiceHealth();
 * if (degraded) return <DegradedModeBanner services={services} />;
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { logger } from "@/app/lib/logger";
import type { CircuitBreakerSnapshot } from "@/app/lib/circuitBreaker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceHealthState {
  /** True when at least one circuit breaker is not in CLOSED state. */
  degraded: boolean;
  /** Per-service snapshots from the circuit-breaker registry. */
  services: CircuitBreakerSnapshot[];
  /** True on the initial fetch before any data has arrived. */
  loading: boolean;
  /** Timestamp (ms) of the last successful poll, or null. */
  lastCheckedAt: number | null;
  /** Error message from the last failed poll attempt, or null. */
  fetchError: string | null;
  /** Force an immediate re-poll outside the interval schedule. */
  refresh: () => void;
}

interface CircuitBreakersApiResponse {
  data: {
    overallDegraded: boolean;
    breakers: CircuitBreakerSnapshot[];
  } | null;
  error: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const ENDPOINT = "/api/health/circuit-breakers";

export function useServiceHealth(
  /** Poll interval in ms. Default: 30 000 (30 s). */
  intervalMs = 30_000
): ServiceHealthState {
  const [degraded, setDegraded] = useState(false);
  const [services, setServices] = useState<CircuitBreakerSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const poll = useCallback(async () => {
    // Don't poll when the tab is in the background — save network and battery.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }

    try {
      const res = await fetch(ENDPOINT, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`Health check returned HTTP ${res.status}`);
      }

      const body = (await res.json()) as CircuitBreakersApiResponse;

      if (!isMountedRef.current) return;

      if (body.error || !body.data) {
        throw new Error(body.error ?? "Unexpected response shape");
      }

      setDegraded(body.data.overallDegraded);
      setServices(body.data.breakers);
      setLastCheckedAt(Date.now());
      setFetchError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn("[useServiceHealth] Poll failed:", message);
      setFetchError(message);
      // Preserve last known state — don't flip degraded to false on a fetch error.
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Start / restart the interval whenever intervalMs changes.
  useEffect(() => {
    isMountedRef.current = true;

    // Fire immediately on mount.
    void poll();

    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [poll, intervalMs]);

  // Resume polling when the tab becomes visible again.
  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [poll]);

  const refresh = useCallback(() => {
    void poll();
  }, [poll]);

  return { degraded, services, loading, lastCheckedAt, fetchError, refresh };
}
