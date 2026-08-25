"use client";

import React from "react";
import { X, CheckCircle, AlertCircle, Loader2, Clock, RefreshCw, Ban } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";
import { useTransformStatus } from "@/app/hooks/useTransformStatus";
import type { BatchTransformState, BatchTransformJob, BatchJobStatus } from "@/app/store/types";

// ─── Per-job poller ───────────────────────────────────────────────────────────

/**
 * Mounts a polling watcher for a single job.
 * Rendered only for jobs that are not yet in a terminal state.
 */
function JobPoller({ jobId }: { jobId: string }) {
  useTransformStatus(jobId, true);
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchTransformQueueProps {
  /** The active batch state from useBatchTransform. */
  batch: BatchTransformState;
  /** Count of jobs in a terminal state. */
  completedCount: number;
  /** Total jobs in the batch. */
  totalCount: number;
  /** Cancel a single job by its jobId. */
  onCancelJob: (jobId: string) => void;
  /** Dismiss/close the entire queue panel. */
  onDismiss: () => void;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: BatchJobStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle className="w-4 h-4 text-green-400 shrink-0" aria-hidden="true" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />;
    case "cancelled":
      return <Ban className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />;
    case "processing":
      return (
        <RefreshCw
          className="w-4 h-4 text-brand animate-spin shrink-0"
          aria-label="Processing"
        />
      );
    case "queued":
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />;
  }
}

function statusLabel(status: BatchJobStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "error":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "processing":
      return "Processing";
    case "queued":
    default:
      return "Queued";
  }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function OverallProgressBar({
  completedCount,
  totalCount,
}: {
  completedCount: number;
  totalCount: number;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-white">
          {completedCount} of {totalCount} transform{totalCount !== 1 ? "s" : ""} complete
        </span>
        <span className="text-xs font-bold text-brand">{pct}%</span>
      </div>
      <div
        className="h-2 w-full bg-input rounded-full overflow-hidden border border-white/5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Overall batch progress: ${pct}%`}
      >
        <div
          className="h-full bg-brand rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,255,133,0.35)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Single job row ───────────────────────────────────────────────────────────

function JobRow({
  job,
  onCancel,
}: {
  job: BatchTransformJob;
  onCancel: (jobId: string) => void;
}) {
  const isTerminal =
    job.status === "complete" || job.status === "error" || job.status === "cancelled";
  const canCancel = !isTerminal;

  const safeClipId = sanitize(job.clipId);
  const safeError = job.errorMessage ? sanitize(job.errorMessage) : null;

  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <StatusIcon status={job.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white truncate">
            Clip {safeClipId}
          </span>
          <span
            className={[
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
              job.status === "complete"
                ? "bg-green-500/15 text-green-400"
                : job.status === "error"
                  ? "bg-red-500/15 text-red-400"
                  : job.status === "cancelled"
                    ? "bg-gray-500/15 text-gray-400"
                    : job.status === "processing"
                      ? "bg-brand/15 text-brand"
                      : "bg-white/5 text-muted-foreground",
            ].join(" ")}
          >
            {statusLabel(job.status)}
          </span>
        </div>

        {/* Per-job progress bar (only for active jobs) */}
        {(job.status === "processing" || job.status === "queued") && (
          <div className="mt-1.5 h-1 w-full bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-brand/60 rounded-full transition-all duration-500"
              style={{
                width: job.status === "queued" ? "0%" : `${job.progress}%`,
              }}
            />
          </div>
        )}

        {safeError && (
          <p className="mt-0.5 text-[10px] text-red-400 truncate">{safeError}</p>
        )}
      </div>

      {canCancel && (
        <button
          onClick={() => onCancel(job.jobId)}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          aria-label={`Cancel transform for clip ${safeClipId}`}
          title="Cancel this transform"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Batch transform queue panel.
 *
 * Displays overall progress ("3 of 10 transforms complete"), a list of
 * individual clip jobs with their status, and a per-clip cancel button.
 *
 * Renders as a floating card docked to the bottom-right of the viewport.
 */
export function BatchTransformQueue({
  batch,
  completedCount,
  totalCount,
  onCancelJob,
  onDismiss,
}: BatchTransformQueueProps) {
  const jobList = Object.values(batch.jobs);
  const allDone = completedCount === totalCount && totalCount > 0;

  const safeStyle =
    batch.style.charAt(0).toUpperCase() + sanitize(batch.style).slice(1);

  // Active (non-terminal) jobs that need polling
  const activeJobIds = jobList
    .filter((j) => j.status === "queued" || j.status === "processing")
    .map((j) => j.jobId);

  return (
    /* Polling watchers — rendered outside the visible DOM */
    <>
      {activeJobIds.map((jobId) => (
        <JobPoller key={jobId} jobId={jobId} />
      ))}
      <aside
      className={[
        "fixed bottom-20 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]",
        "bg-surface border border-white/10 rounded-2xl shadow-2xl",
        "flex flex-col overflow-hidden",
        "animate-in slide-in-from-bottom-4 duration-300",
      ].join(" ")}
      aria-label="Batch transform queue"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {allDone ? (
            <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
          ) : (
            <Loader2 className="w-4 h-4 text-brand animate-spin" aria-hidden="true" />
          )}
          <span className="text-sm font-bold text-white">
            {allDone ? "Batch Complete" : "Transforming…"}
          </span>
          <span className="text-xs text-muted-foreground">· {safeStyle}</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss batch transform queue"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Overall progress */}
      <div className="px-4 pt-3 pb-2">
        <OverallProgressBar completedCount={completedCount} totalCount={totalCount} />
      </div>

      {/* Job list (scrollable) */}
      <ul
        className="px-4 pb-2 overflow-y-auto max-h-[240px] scrollbar-hide"
        aria-label="Individual transform jobs"
      >
        {jobList.map((job) => (
          <JobRow key={job.jobId} job={job} onCancel={onCancelJob} />
        ))}
      </ul>

      {/* Footer — only show dismiss when all done */}
      {allDone && (
        <div className="px-4 py-3 border-t border-white/5">
          <button
            onClick={onDismiss}
            className="w-full py-2 rounded-xl bg-brand text-black text-xs font-bold hover:bg-brand/90 transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
