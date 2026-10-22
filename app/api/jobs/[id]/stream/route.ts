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
 *
 * Resumption: every frame carries a monotonically increasing `id:`. A client
 * that reconnects with `Last-Event-ID` (header, or `lastEventId` query param
 * for managed reconnects) gets the frames it missed replayed from the job
 * event log, followed by the current job state if it is newer still.
 */

import { NextRequest } from "next/server";
import { jobStore } from "../../shared/jobStore";
import { requireJobOwner } from "../../shared/authGuard";
import { logger } from "@/app/lib/logger";
import {
  formatSseEvent,
  jobEventLog,
  parseLastEventId,
  type SseEvent,
} from "@/app/lib/sse/eventLog";
import type { Job } from "../../shared/jobStore";
import { deprecatedAlias } from "@/app/api/versioning";
import type { ApiKeyRouteContext } from "@/app/lib/apiKey";

const POLL_INTERVAL_MS = 1_000;
/**
 * After this many consecutive store read failures the stream sends an error
 * event and closes rather than looping indefinitely on a downed Redis.
 */
const MAX_STORE_ERRORS = 5;
/**
 * Unchanged job state is not re-sent, so a comment frame keeps proxies from
 * timing out an idle stream. Sent after this many quiet poll ticks.
 */
const HEARTBEAT_EVERY_TICKS = 15;

async function getJobStream(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } & Partial<ApiKeyRouteContext>
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId, context.apiKey?.userId);
  if (result instanceof Response) return result;

  const lastEventId = parseLastEventId(request);

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let consecutiveStoreErrors = 0;
      let quietTicks = 0;
      // Highest event ID this connection has delivered (or the client already
      // had). Anything at or below it is never sent twice.
      let lastSentId = lastEventId ?? 0;

      // Replay frames the client missed while disconnected, then send the
      // current state immediately so it doesn't wait for the first poll.
      (async () => {
        if (lastEventId !== null) {
          const missed = jobEventLog.since(jobId, lastEventId);
          if (missed.length > 0) {
            logger.info(
              `[SSE:${jobId}] Resuming after event ${lastEventId}: replaying ${missed.length} event(s)`
            );
          }
          for (const event of missed) safeSendFrame(controller, event);
        }

        try {
          const initial = await jobStore.get(jobId);
          if (initial) safeSendJob(controller, initial);
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
            err
          );

          if (consecutiveStoreErrors >= MAX_STORE_ERRORS) {
            logger.error(
              `[SSE:${jobId}] Store unavailable after ${MAX_STORE_ERRORS} attempts — closing stream`
            );
            safeSendErrorEvent(
              controller,
              "STORE_UNAVAILABLE",
              "Job store is temporarily unavailable. Please refresh to reconnect."
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

        if (!safeSendJob(controller, job)) {
          quietTicks += 1;
          if (quietTicks >= HEARTBEAT_EVERY_TICKS) {
            quietTicks = 0;
            safeEnqueue(controller, ": keep-alive\n\n");
          }
        } else {
          quietTicks = 0;
        }

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
      function safeEnqueue(c: ReadableStreamDefaultController, chunk: string) {
        if (closed) return;
        try {
          c.enqueue(new TextEncoder().encode(chunk));
        } catch {
          /* stream already closed */
        }
      }

      function safeSendFrame(c: ReadableStreamDefaultController, event: SseEvent) {
        if (event.id <= lastSentId) return;
        lastSentId = event.id;
        safeEnqueue(c, formatSseEvent(event));
      }

      /** Record the job snapshot and send it if it is newer than what the client has. */
      function safeSendJob(c: ReadableStreamDefaultController, job: Job): boolean {
        if (closed) return false;
        const { event } = jobEventLog.append(jobId, serializeJob(job));
        if (event.id <= lastSentId) return false;
        safeSendFrame(c, event);
        return true;
      }

      function safeSendErrorEvent(
        c: ReadableStreamDefaultController,
        errorCode: string,
        errorMessage: string
      ) {
        if (closed) return;
        // Transient errors get an ID but are not logged, so they are never
        // replayed to a client that reconnects after the store recovers.
        safeSendFrame(c, {
          id: jobEventLog.nextId(jobId),
          data: serializeError(errorCode, errorMessage),
        });
      }

      function safeClose(c: ReadableStreamDefaultController) {
        if (closed) return;
        closed = true;
        try {
          c.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Prevent Vercel / nginx from buffering SSE responses.
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function serializeJob(job: Job): string {
  return JSON.stringify({
    progress: job.progress,
    status: job.status,
    momentsFound: job.momentsFound,
    estimatedSecondsRemaining: job.estimatedSecondsRemaining,
    ...(job.errorCode ? { errorCode: job.errorCode } : {}),
    ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
  });
}

function serializeError(errorCode: string, errorMessage: string): string {
  return JSON.stringify({
    status: "error",
    progress: 0,
    momentsFound: 0,
    estimatedSecondsRemaining: 0,
    errorCode,
    errorMessage,
  });
}

export const GET = deprecatedAlias(getJobStream);
