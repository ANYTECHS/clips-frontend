"use client";

import { useEffect, useRef, useCallback } from "react";
import { useProcessStore, selectHasHydrated } from "@/app/store/processStore";
import { ProcessStatus } from "@/app/store/types";
import { logger } from "@/app/lib/logger";

/** Real-time data schema updating background pipeline progress metrics */
interface JobStatus {
  /** Numerical representation showing execution milestone percentages */
  progress: number;
  /** Current state enum of the underlying processing pipeline */
  status: ProcessStatus;
  /** Found artifact instances extracted during stream processing */
  momentsFound: number;
  /** Time remaining estimations in seconds before lifecycle completion, or null */
  estimatedSecondsRemaining: number | null;
}

/**
 * Hook to get job status from the backend (uses SSE first, falls back to polling)
 * * @param jobId - The job ID to poll
 * @param enabled - Whether polling is enabled (default: true)
 * @returns Interface actions enabling consumers to explicitly suspend active transport listeners.
 */
export function useProcessingStatus(jobId: string | null, enabled: boolean = true, maxReconnectAttempts: number = 3) {
  const hasHydrated = useProcessStore(selectHasHydrated);
  const { update, startProcess, resetProcess } = useProcessStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  const jobIdRef = useRef(jobId);
  const isDestroyedRef = useRef(false);
  const startSSERef = useRef<(() => void) | null>(null);
  const startPollingFallbackRef = useRef<(() => void) | null>(null);

  // Don't start polling until the store is hydrated
  if (!hasHydrated) {
    return { stopPolling: () => {} };
  }

  /**
   * Suspends long-polling intervals, turning off active HTTP loop updates.
   */
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

  /**
   * Disconnects continuous EventSource contexts, discarding open stream descriptors.
   */
  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Unified cleanup execution block killing both SSE pipes and manual fallback loops simultaneously.
   */
  const stopAll = useCallback(() => {
    stopSSE();
    stopPolling();
    stopReconnect();
    isDestroyedRef.current = true;
  }, [stopSSE, stopPolling, stopReconnect]);

  /**
   * Parses current chunk payloads, pushing update mutations down into central store layers.
   * * @param data - Decoded live metrics block captured from incoming stream event packets.
   */
  const updateFromData = useCallback((data: JobStatus) => {
    update({
      progress: data.progress,
      status: data.status,
      momentsFound: data.momentsFound,
      estimatedSecondsRemaining: data.estimatedSecondsRemaining,
    });

    if (data.status === "complete" || data.status === "error") {
      stopAll();

      if (data.status === "complete") {
        update({ completedAt: Date.now() });
      }
    }
  }, [update, stopAll]);

  /**
   * Manual fallback runner executing singular HTTP fetch requests to resolve pipeline states.
   */
  const fetchStatus = useCallback(async () => {
    if (!jobId || isPollingRef.current) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }

      const data: JobStatus = await response.json();
      updateFromData(data);
    } catch (error) {
      logger.error("Error fetching job status:", error);
    }
  }, [jobId, updateFromData]);

  useEffect(() => {
    isDestroyedRef.current = false;
    enabledRef.current = enabled;
    jobIdRef.current = jobId;

    if (!enabled || !jobId) {
      stopAll();
      return;
    }

    const startSSE = () => {
      if (isDestroyedRef.current) return;

      const es = new EventSource(`/api/jobs/${jobIdRef.current}/stream`);
      eventSourceRef.current = es;
      reconnectAttemptsRef.current = 0;

      es.onmessage = (event) => {
        try {
          const data: JobStatus = JSON.parse(event.data);
          updateFromData(data);
          // Reset reconnection counter on successful message
          reconnectAttemptsRef.current = 0;
        } catch (error) {
          logger.error("Error parsing SSE data:", error);
        }
      };

      es.onerror = () => {
        if (isDestroyedRef.current) return;

        // Immediately close the EventSource to prevent native auto-reconnect
        es.close();
        eventSourceRef.current = null;

        reconnectAttemptsRef.current += 1;
        const attempt = reconnectAttemptsRef.current;

        logger.warn(`SSE connection error (attempt ${attempt}/${maxReconnectAttempts})`);

        if (attempt >= maxReconnectAttempts) {
          // Max attempts reached, fall back to polling
          logger.warn("SSE max reconnect attempts reached, falling back to polling");
          startPollingFallbackRef.current?.();
        } else {
          // Exponential backoff: 1s, 2s, 4s, ...
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
          logger.info(`Reconnecting SSE in ${delay}ms (attempt ${attempt + 1}/${maxReconnectAttempts})`);
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
      fetchStatus();
      intervalRef.current = setInterval(fetchStatus, 3000);
    };

    startSSERef.current = startSSE;
    startPollingFallbackRef.current = startPollingFallback;

    // Start with SSE
    startSSERef.current();

    return () => {
      stopAll();
      startSSERef.current = null;
      startPollingFallbackRef.current = null;
    };
  }, [jobId, enabled, maxReconnectAttempts, fetchStatus, updateFromData, stopAll, stopReconnect]);

  return { stopPolling: stopAll };
}


