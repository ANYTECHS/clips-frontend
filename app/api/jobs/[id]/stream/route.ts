import { NextRequest } from "next/server";
import { jobStore } from "../../shared/jobStore";
import { requireJobOwner } from "../../shared/authGuard";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;
  const result = await requireJobOwner(jobId);
  if (result instanceof Response) return result;

  const stream = new ReadableStream({
    async start(controller) {
      let job = jobStore.get(jobId)!;
      sendUpdate(controller, job);

      const intervalId = setInterval(() => {
        job = jobStore.get(jobId)!;

        if (job.status === "processing") {
          const elapsed = (Date.now() - job.createdAt) / 1000;
          const newProgress = Math.min(95, Math.floor(elapsed * 0.5));

          if (newProgress !== job.progress) {
            job.progress = newProgress;
            job.estimatedSecondsRemaining = Math.max(0, 300 - elapsed);

            if (newProgress > 20 && job.momentsFound === 0) {
              job.momentsFound = Math.floor(Math.random() * 5) + 1;
            }
            if (newProgress > 60 && job.momentsFound < 3) {
              job.momentsFound = Math.floor(Math.random() * 8) + 3;
            }

            jobStore.set(jobId, job);
          }

          if (newProgress >= 95 && elapsed > 180) {
            job = { ...job, status: "complete", progress: 100, estimatedSecondsRemaining: 0 };
            jobStore.set(jobId, job);
            sendUpdate(controller, job);
            clearInterval(intervalId);
            controller.close();
            return;
          }
        } else {
          sendUpdate(controller, job);
          clearInterval(intervalId);
          controller.close();
          return;
        }

        sendUpdate(controller, job);
      }, 500);

      request.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function sendUpdate(controller: ReadableStreamDefaultController, data: { progress: number; status: string; momentsFound: number; estimatedSecondsRemaining: number }) {
  const payload = JSON.stringify({
    progress: data.progress,
    status: data.status,
    momentsFound: data.momentsFound,
    estimatedSecondsRemaining: data.estimatedSecondsRemaining,
  });
  controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
}
