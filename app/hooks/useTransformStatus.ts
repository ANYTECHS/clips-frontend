"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  useTransformStore,
  selectTransformHasHydrated,
} from "@/app/store/transformStore";
import type { TransformJob, TransformStatus } from "@/app/store/transformStore";
import { logger } from "@/app/lib/logger";

/** Payload from GET /api/transform/[id] and the SSE stream. */
interface TransformStatusMessage {
  progress: number;
  status: TransformStatus;
  previewUrl?: string | null;
  resultUrl?: string | null;
  errorMessage?: string;
}

const POLL_INTERVAL_MS = 3_000;
const TERMINAL_STATUSES: TransformStatus[] = ["complete", "error"];

/**
 * Track a transform job via SSE first, falling back to polling
 * GET /api/transform/[id] every 3s when the stream fails.
 *
 * Mirrors `useProcessingStatus` structure: reconnect with backoff, then poll.
 * Updates `transformStore.jobs[jobId]` on each event.
 *
 * @param jobId - Transform job id to monitor, or null to stay idle.
 * @param enabled - When false, tears down SSE/polling (default: true).
 * @param maxReconnectAttempts - SSE retries before polling fallback (default: 3).
 */
export function useTransformStatus(
  jobId: string | null,
  enabled: boolean = true,
  maxReconnectAttempts: number = 3,
) {
  const hasHydrated = useTransformStore(selectTransformHasHydrated);
  const { updateJob } = useTransformStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  const jobIdRef = useRef(jobId);
  const isDestroyedRef = useRef(false);
  const startSSERef = useRef<(() => void) | null>(null);
  const startPollingFallbackRef = useRef<(() => void) | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const stopReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  const stopAll = useCallback(() => {
    stopSSE();
    stopPolling();
    stopReconnect();
    isDestroyedRef.current = true;
  }, [stopSSE, stopPolling, stopReconnect]);

  const updateFromData = useCallback(
    (data: TransformStatusMessage) => {
      const id = jobIdRef.current;
      if (!id) return;

      const patch: Partial<TransformJob> = {
        progress: data.progress,
        status: data.status,
      };
      if (data.previewUrl != null) patch.previewUrl = data.previewUrl;
      if (data.resultUrl != null) patch.resultUrl = data.resultUrl;
      if (data.errorMessage != null) patch.errorMessage = data.errorMessage;

      updateJob(id, patch);

      if (TERMINAL_STATUSES.includes(data.status)) {
        stopAll();
      }
    },
    [updateJob, stopAll],
  );

  const fetchStatus = useCallback(async () => {
    const id = jobIdRef.current;
    if (!id) return;

    try {
      const response = await fetch(`/api/transform/${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch transform status: ${response.statusText}`);
      }
      const data: TransformStatusMessage = await response.json();
      updateFromData(data);
    } catch (error) {
      logger.error("Error fetching transform status:", error);
    }
  }, [updateFromData]);

  useEffect(() => {
    isDestroyedRef.current = false;
    enabledRef.current = enabled;
    jobIdRef.current = jobId;

    if (!hasHydrated || !enabled || !jobId) {
      stopAll();
      isDestroyedRef.current = false;
      return;
    }

    const startSSE = () => {
      if (isDestroyedRef.current) return;

      const es = new EventSource(`/api/transform/${jobIdRef.current}/stream`);
      eventSourceRef.current = es;
      reconnectAttemptsRef.current = 0;

      es.onmessage = (event) => {
        try {
          const data: TransformStatusMessage = JSON.parse(event.data);
          updateFromData(data);
          reconnectAttemptsRef.current = 0;
        } catch (error) {
          logger.error("Error parsing transform SSE data:", error);
        }
      };

      es.onerror = () => {
        if (isDestroyedRef.current) return;

        es.close();
        eventSourceRef.current = null;

        reconnectAttemptsRef.current += 1;
        const attempt = reconnectAttemptsRef.current;

        logger.warn(
          `Transform SSE connection error (attempt ${attempt}/${maxReconnectAttempts})`,
        );

        if (attempt >= maxReconnectAttempts) {
          logger.warn(
            "Transform SSE max reconnect attempts reached, falling back to polling",
          );
          startPollingFallbackRef.current?.();
        } else {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
          logger.info(
            `Reconnecting transform SSE in ${delay}ms (attempt ${attempt + 1}/${maxReconnectAttempts})`,
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isDestroyedRef.current) {
              startSSERef.current?.();
            }
          }, delay);
        }
      };
    };

    const startPollingFallback = () => {
      isPollingRef.current = true;
      void fetchStatus();
      intervalRef.current = setInterval(() => {
        void fetchStatus();
      }, POLL_INTERVAL_MS);
    };

    startSSERef.current = startSSE;
    startPollingFallbackRef.current = startPollingFallback;

    startSSERef.current();

    return () => {
      stopAll();
      startSSERef.current = null;
      startPollingFallbackRef.current = null;
    };
  }, [
    jobId,
    enabled,
    hasHydrated,
    maxReconnectAttempts,
    fetchStatus,
    updateFromData,
    stopAll,
  ]);

  return { stopPolling: stopAll };
}
