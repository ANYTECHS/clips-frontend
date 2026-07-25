"use client";

/**
 * BatchTransformQueue
 *
 * Floating panel that shows the progress of a batch AI transform.
 * - Header: "X of Y transforms complete" + collapse toggle
 * - Each job row: clip title, style badge, progress bar, status chip,
 *   individual cancel button for active jobs
 * - Footer: Cancel All (when jobs are active) + Clear Finished
 *
 * Accessibility: all interactive elements have aria-labels and keyboard focus
 * styles. The panel is keyboard-navigable with Tab/Shift-Tab.
 */

import React, { useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Wand2,
} from "lucide-react";
import {
  useBatchTransformStore,
  selectJobs,
  selectIsQueueOpen,
  selectJobCounts,
} from "@/app/store/batchTransformStore";
import type { TransformJob, TransformJobStatus } from "@/app/store/types";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: TransformJobStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="w-4 h-4 text-brand shrink-0" aria-label="Complete" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-400 shrink-0" aria-label="Error" />;
    case "cancelled":
      return <XCircle className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Cancelled" />;
    case "processing":
      return (
        <Loader2
          className="w-4 h-4 text-brand shrink-0 animate-spin"
          aria-label="Processing"
        />
      );
    case "queued":
    default:
      return <Clock className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Queued" />;
  }
}

function statusLabel(status: TransformJobStatus): string {
  switch (status) {
    case "complete":    return "Complete";
    case "error":       return "Error";
    case "cancelled":   return "Cancelled";
    case "processing":  return "Processing…";
    case "queued":
    default:            return "Queued";
  }
}

function statusColor(status: TransformJobStatus): string {
  switch (status) {
    case "complete":    return "text-brand";
    case "error":       return "text-red-400";
    case "cancelled":   return "text-muted-foreground line-through";
    case "processing":  return "text-white";
    case "queued":
    default:            return "text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// Job row
// ---------------------------------------------------------------------------

interface JobRowProps {
  job: TransformJob;
  onCancel: (jobId: string) => void;
}

function JobRow({ job, onCancel }: JobRowProps) {
  const isActive = job.status === "queued" || job.status === "processing";

  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0"
      role="listitem"
    >
      {/* Status icon */}
      <StatusIcon status={job.status} />

      {/* Clip title + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className={`text-[12px] font-semibold truncate ${
              job.status === "cancelled" ? "text-muted-foreground line-through" : "text-white"
            }`}
            title={job.clipTitle}
          >
            {job.clipTitle}
          </p>
          <span className={`text-[11px] font-medium shrink-0 ${statusColor(job.status)}`}>
            {statusLabel(job.status)}
          </span>
        </div>

        {/* Progress bar — only shown while active */}
        {(isActive || job.status === "complete") && (
          <div
            className="h-1.5 rounded-full bg-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={job.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${job.clipTitle} progress`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                job.status === "complete"
                  ? "bg-brand"
                  : "bg-brand/70"
              }`}
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}

        {/* Error message */}
        {job.status === "error" && job.error && (
          <p className="text-[11px] text-red-400 mt-0.5 truncate">{job.error}</p>
        )}
      </div>

      {/* Style badge */}
      <span className="hidden sm:inline-flex shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
        {job.style}
      </span>

      {/* Cancel button — active jobs only */}
      {isActive && (
        <button
          onClick={() => onCancel(job.jobId)}
          className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand shrink-0"
          aria-label={`Cancel transform for ${job.clipTitle}`}
          title="Cancel this transform"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BatchTransformQueue() {
  const jobs = useBatchTransformStore(selectJobs);
  const isOpen = useBatchTransformStore(selectIsQueueOpen);
  const counts = useBatchTransformStore(selectJobCounts);

  const toggleQueue = useBatchTransformStore((s) => s.toggleQueue);
  const cancelJob = useBatchTransformStore((s) => s.cancelJob);
  const cancelAll = useBatchTransformStore((s) => s.cancelAll);
  const clearFinished = useBatchTransformStore((s) => s.clearFinished);

  const handleCancelJob = useCallback(
    (jobId: string) => cancelJob(jobId),
    [cancelJob]
  );

  // Don't render if there are no jobs at all
  if (counts.total === 0) return null;

  const hasFinished =
    counts.complete > 0 || counts.cancelled > 0 || counts.error > 0;
  const hasActive = counts.active > 0;

  // Progress summary text
  const summaryText = counts.isDone
    ? counts.error > 0
      ? `${counts.complete} of ${counts.total} complete — ${counts.error} failed`
      : `All ${counts.total} transforms complete`
    : `${counts.complete} of ${counts.total} transforms complete`;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="region"
      aria-label="Batch transform queue"
    >
      <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* ── Header ── */}
        <button
          onClick={() => toggleQueue()}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          aria-expanded={isOpen}
          aria-controls="batch-queue-body"
        >
          {/* Wand icon */}
          <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <Wand2 className="w-4 h-4 text-brand" />
          </div>

          {/* Summary */}
          <div className="flex-1 text-left min-w-0">
            <p className="text-[13px] font-bold text-white leading-tight">
              {counts.isDone ? "Batch transform complete" : "Transforming clips…"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{summaryText}</p>
          </div>

          {/* Overall progress ring or spinner */}
          <div className="shrink-0 mr-1" aria-hidden="true">
            {hasActive ? (
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-brand" />
            )}
          </div>

          {/* Collapse chevron */}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          )}
        </button>

        {/* ── Overall progress bar ── */}
        <div className="px-5 pb-1">
          <div
            className="h-1 rounded-full bg-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={counts.total > 0 ? Math.round((counts.complete / counts.total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Overall batch progress: ${counts.complete} of ${counts.total}`}
          >
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{
                width: `${counts.total > 0 ? (counts.complete / counts.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* ── Expandable job list ── */}
        {isOpen && (
          <div id="batch-queue-body">
            {/* Scrollable job list */}
            <div
              className="px-5 max-h-[280px] overflow-y-auto scrollbar-hide"
              role="list"
              aria-label="Transform jobs"
            >
              {jobs.map((job) => (
                <JobRow key={job.jobId} job={job} onCancel={handleCancelJob} />
              ))}
            </div>

            {/* Footer actions */}
            {(hasActive || hasFinished) && (
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5 bg-black/20">
                {hasFinished && (
                  <button
                    onClick={clearFinished}
                    className="text-[12px] font-medium text-muted-foreground hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded"
                    aria-label="Clear finished transforms from the queue"
                  >
                    Clear finished
                  </button>
                )}

                {!hasFinished && <div />}

                {hasActive && (
                  <button
                    onClick={cancelAll}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-red-400 hover:text-red-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 rounded"
                    aria-label="Cancel all active transforms"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel all
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
