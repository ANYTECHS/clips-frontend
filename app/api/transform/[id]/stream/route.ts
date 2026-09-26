/**
 * GET /api/transform/[id]/stream
 *
 * Server-Sent Events stream for transform job progress. Same pattern as
 * `/api/jobs/[id]/stream`: polls the shared job store and pushes updates
 * until the job reaches a terminal state or the client disconnects.
 *
 * Event payload: `{ progress, status, previewUrl?, resultUrl?, errorMessage? }`
 */

import { NextRequest } from "next/server";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { requireJobOwner } from "@/app/api/jobs/shared/authGuard";
import {
  toTransformStatusPayload,
  type TransformJobRecord,
} from "../route";

const POLL_INTERVAL_MS = 1_000;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId);
  if (result instanceof Response) return result;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const encoder = new TextEncoder();

      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          /* stream already closed */
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      void (async () => {
        const initial = await jobStore.get(jobId);
        if (initial) {
          send(toTransformStatusPayload(initial as TransformJobRecord));
          if (initial.status === "complete" || initial.status === "error") {
            close();
            return;
          }
        }

        const intervalId = setInterval(() => {
          void (async () => {
            const job = await jobStore.get(jobId);

            if (!job) {
              send({
                status: "error",
                progress: 0,
                errorMessage: "Job no longer exists",
              });
              clearInterval(intervalId);
              close();
              return;
            }

            send(toTransformStatusPayload(job as TransformJobRecord));

            if (job.status === "complete" || job.status === "error") {
              clearInterval(intervalId);
              close();
            }
          })();
        }, POLL_INTERVAL_MS);

        request.signal.addEventListener("abort", () => {
          clearInterval(intervalId);
          closed = true;
        });
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
