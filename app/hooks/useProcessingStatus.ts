"use client";

import { useEffect, useRef, useCallback } from "react";
import { useProcessStore } from "@/app/store/processStore";
import { ProcessStatus } from "@/app/store/types";

interface JobStatus {
  progress: number;
  status: ProcessStatus;
  momentsFound: number;
  estimatedSecondsRemaining: number | null;
}

/**
 * Hook to get job status from the backend (uses SSE first, falls back to polling)
 * @param jobId - The job ID to poll
 * @param enabled - Whether polling is enabled (default: true)
 */
export function useProcessingStatus(jobId: string | null, enabled: boolean = true) {
  const { update, startProcess, resetProcess } = useProcessStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    stopSSE();
    stopPolling();
  }, [stopSSE, stopPolling]);

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
      console.error("Error fetching job status:", error);
    }
  }, [jobId, updateFromData]);

  useEffect(() => {
    if (!enabled || !jobId) {
      stopAll();
      return;
    }

    // Try SSE first
    const startSSE = () => {
      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data: JobStatus = JSON.parse(event.data);
          updateFromData(data);
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      es.onerror = () => {
        console.warn("SSE connection failed, falling back to polling");
        stopSSE();
        startPollingFallback();
      };
    };

    const startPollingFallback = () => {
      isPollingRef.current = true;
      fetchStatus();
      intervalRef.current = setInterval(fetchStatus, 3000);
    };

    startSSE();

    return () => {
      stopAll();
    };
  }, [jobId, enabled, fetchStatus, updateFromData, stopAll]);

  return { stopPolling: stopAll };
}

/**
 * Mock API endpoint for development/testing
 * This simulates a job status response
 */
export async function mockFetchJobStatus(jobId: string): Promise<JobStatus> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // For demo purposes, simulate progress
  const stored = localStorage.getItem(`job_${jobId}`);
  const jobData = stored ? JSON.parse(stored) : null;

  if (!jobData) {
    return {
      progress: 0,
      status: "processing",
      momentsFound: 0,
      estimatedSecondsRemaining: 300,
    };
  }

  return jobData;
}
