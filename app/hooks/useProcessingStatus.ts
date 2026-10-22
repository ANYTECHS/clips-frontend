"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useProcessStore, selectHasHydrated } from "@/app/store/processStore";
import { ProcessStatus } from "@/app/store/types";
import { logger } from "@/app/lib/logger";
import {
  DEFAULT_MAX_RETRIES,
  openManagedEventSource,
  type ManagedEventSource,
} from "@/app/lib/sse/ManagedEventSource";

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
 * Transport state, for surfacing connection health in the UI.
 *
 * - `connecting`: first SSE connection is being opened
 * - `connected`: SSE stream is open
 * - `reconnecting`: the stream dropped and a backoff retry is pending
 * - `polling`: SSE gave up; status comes from `GET /api/jobs/[id]`
 * - `idle`: nothing is being watched (disabled, no job, or job finished)
 */
export type ProcessingConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "polling";

const POLL_INTERVAL_MS = 3_000;

/**
 * Hook to get job status from the backend.
 *
 * Streams over SSE first. If the connection drops it reconnects with
 * exponential backoff (1s, 2s, 4s, 8s, … capped at 30s) and resumes from the
 * last received event ID so no updates are missed. After `maxReconnectAttempts`
 * failed reconnects it falls back to polling `GET /api/jobs/[id]`.
 *
 * @param jobId - The job ID to watch
 * @param enabled - Whether watching is enabled (default: true)
 * @param maxReconnectAttempts - SSE reconnects before falling back to polling (default: 5)
 * @returns `stopPolling` to stop all transports, and the current `connectionState`.
 */
export function useProcessingStatus(
  jobId: string | null,
  enabled: boolean = true,
  maxReconnectAttempts: number = DEFAULT_MAX_RETRIES
) {
  const hasHydrated = useProcessStore(selectHasHydrated);
  const update = useProcessStore((s) => s.update);
  const [connectionState, setConnectionState] = useState<ProcessingConnectionState>("idle");
  const streamRef = useRef<ManagedEventSource | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInFlightRef = useRef(false);
  const isDestroyedRef = useRef(false);

  /**
   * Stops the SSE stream and the polling fallback together.
   */
  const stopAll = useCallback(() => {
    isDestroyedRef.current = true;
    streamRef.current?.close();
    streamRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setConnectionState("idle");
  }, []);

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
    if (!jobId || fetchInFlightRef.current || isDestroyedRef.current) return;
    fetchInFlightRef.current = true;

    try {
      const response = await fetch(`/api/jobs/${jobId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }

      const data: JobStatus = await response.json();
      if (!isDestroyedRef.current) updateFromData(data);
    } catch (error) {
      logger.error("Error fetching job status:", error);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [jobId, updateFromData]);

  useEffect(() => {
    // Don't start watching until the store is hydrated
    if (!hasHydrated || !enabled || !jobId) return;

    isDestroyedRef.current = false;

    const startPollingFallback = () => {
      if (isDestroyedRef.current || intervalRef.current) return;
      setConnectionState("polling");
      fetchStatus();
      intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectionState("connecting");
    let stream: ManagedEventSource | null = null;
    try {
      stream = openManagedEventSource({
        url: `/api/jobs/${encodeURIComponent(jobId)}/stream`,
        maxRetries: maxReconnectAttempts,
        listeners: {
          message: (raw) => {
            setConnectionState("connected");
            try {
              updateFromData(JSON.parse(raw) as JobStatus);
            } catch (error) {
              logger.error("Error parsing SSE data:", error);
            }
          },
        },
        onOpen: () => setConnectionState("connected"),
        onError: (attempt, willRetry) => {
          if (!willRetry) return;
          logger.warn(`SSE connection dropped, reconnecting (attempt ${attempt}/${maxReconnectAttempts})`);
          setConnectionState("reconnecting");
        },
        onGiveUp: () => {
          logger.warn("SSE max reconnect attempts reached, falling back to polling");
          streamRef.current = null;
          startPollingFallback();
        },
      });
    } catch (error) {
      // Connection pool exhausted — polling still keeps the UI current.
      logger.error("Unable to open SSE stream:", error);
    }

    if (stream) {
      streamRef.current = stream;
    } else {
      startPollingFallback();
    }

    return () => {
      stopAll();
    };
  }, [hasHydrated, jobId, enabled, maxReconnectAttempts, fetchStatus, updateFromData, stopAll]);

  return { stopPolling: stopAll, connectionState };
}
