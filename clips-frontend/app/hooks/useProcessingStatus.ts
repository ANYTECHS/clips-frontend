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
 * Hook to poll job status from the backend
 * @param jobId - The job ID to poll
 * @param enabled - Whether polling is enabled (default: true)
 */
export function useProcessingStatus(jobId: string | null, enabled: boolean = true) {
  const { update, startProcess, resetProcess } = useProcessStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!jobId || isPollingRef.current) return;

    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }

      const data: JobStatus = await response.json();

      // Update the process store with live data
      update({
        progress: data.progress,
        status: data.status,
        momentsFound: data.momentsFound,
        estimatedSecondsRemaining: data.estimatedSecondsRemaining,
      });

      // Stop polling if job is complete or errored
      if (data.status === "complete" || data.status === "error") {
        stopPolling();
        
        if (data.status === "complete") {
          update({ completedAt: Date.now() });
        }
      }
    } catch (error) {
      console.error("Error fetching job status:", error);
      // Don't stop polling on network errors - will retry
    }
  }, [jobId, update, stopPolling]);

  useEffect(() => {
    if (!enabled || !jobId) {
      stopPolling();
      return;
    }

    // Start polling immediately
    isPollingRef.current = true;
    fetchStatus();

    // Then poll every 3 seconds
    intervalRef.current = setInterval(fetchStatus, 3000);

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [jobId, enabled, fetchStatus, stopPolling]);

  return { stopPolling };
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
