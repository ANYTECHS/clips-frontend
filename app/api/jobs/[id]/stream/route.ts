/**
 * GET /api/jobs/[id]/stream
 *
 * Server-Sent Events stream that polls the job store and pushes real updates
 * to the client. The AI backend writes to the store via the callback route;
 * this stream surface those writes as they happen.
 *
 * Poll interval: 1 s (low enough for smooth progress bars, high enough to
 * avoid flooding the DB/Redis with reads).
 *
 * The stream closes when the job reaches a terminal state (complete / error)
 * or when the client disconnects.
 */

import { NextRequest } from "next/server";
import { jobStore } from "../../shared/jobStore";
import { requireJobOwner } from "../../shared/authGuard";
import { logger } from "@/app/lib/logger";
import type { Job } from "../../shared/jobStore";

const POLL_INTERVAL_MS = 1_000;
/**
 * After this many consecutive store read failures the stream sends an error
 * event and closes rather than looping indefinitely on a downed Redis.
 */
const MAX_STORE_ERRORS = 5;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId);
  if (result instanceof Response) return result;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let consecutiveStoreErrors = 0;

      // Send the current state immediately so the client doesn't have to wait
      // for the first poll interval.
      (async () => {
        try {
          const initial = await jobStore.get(jobId);
          if (initial) safeSendEvent(controller, initial);
        } catch (err) {
          logger.error(`[SSE:${jobId}] Failed to read initial job state:`, err);
          // Don't close yet — give the poll loop a chance to recover.
        }
      })();

      const intervalId = setInterval(async () => {
        let job: Job | undefined = undefined;

        try {
          job = await jobStore.get(jobId);
          // A successful read resets the error counter.
          consecutiveStoreErrors = 0;
        } catch (err) {
          consecutiveStoreErrors += 1;
          logger.error(
            `[SSE:${jobId}] Store read error (${consecutiveStoreErrors}/${MAX_STORE_ERRORS}):`,
            err,
          );

          if (consecutiveStoreErrors >= MAX_STORE_ERRORS) {
            logger.error(
              `[SSE:${jobId}] Store unavailable after ${MAX_STORE_ERRORS} attempts — closing stream`,
            );
            safeSendErrorEvent(
              controller,
              "STORE_UNAVAILABLE",
              "Job store is temporarily unavailable. Please refresh to reconnect.",
            );
            clearInterval(intervalId);
            safeClose(controller);
          }
          // Don't process a null job — wait for next tick.
          return;
        }

        if (!job) {
          // Job was deleted while the client was watching — close cleanly.
          safeSendErrorEvent(controller, "JOB_NOT_FOUND", "Job no longer exists");
          clearInterval(intervalId);
          safeClose(controller);
          return;
        }

        safeSendEvent(controller, job);

        // Close once we reach a terminal state so the client doesn't need to
        // poll indefinitely.
        if (job.status === "complete" || job.status === "error") {
          clearInterval(intervalId);
          safeClose(controller);
        }
      }, POLL_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        closed = true;
        // Don't call controller.close() here — the stream is already closing
        // because the client disconnected.
      });

      // ── helpers scoped to this stream instance ──────────────────────────
      function safeSendEvent(c: ReadableStreamDefaultController, job: Job) {
        if (closed) return;
        try { sendEvent(c, job); } catch { /* stream already closed */ }
      }

      function safeSendErrorEvent(
        c: ReadableStreamDefaultController,
        errorCode: string,
        errorMessage: string
      ) {
        if (closed) return;
        try { sendErrorEvent(c, errorCode, errorMessage); } catch { /* stream already closed */ }
      }

      function safeClose(c: ReadableStreamDefaultController) {
        if (closed) return;
        closed = true;
        try { c.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      // Prevent Vercel / nginx from buffering SSE responses.
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sendEvent(controller: ReadableStreamDefaultController, job: Job): void {
  const payload = JSON.stringify({
    progress: job.progress,
    status: job.status,
    momentsFound: job.momentsFound,
    estimatedSecondsRemaining: job.estimatedSecondsRemaining,
    ...(job.errorCode ? { errorCode: job.errorCode } : {}),
    ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
  });
  controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
}

function sendErrorEvent(
  controller: ReadableStreamDefaultController,
  errorCode: string,
  errorMessage: string
): void {
  const payload = JSON.stringify({
    status: "error",
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 0,
    errorCode,
    errorMessage,
  });
  controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
}
