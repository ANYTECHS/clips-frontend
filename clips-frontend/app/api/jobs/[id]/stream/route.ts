import { NextRequest } from "next/server";
import { jobStore } from "../../shared/jobStore";

// In-memory storage for demo purposes (shared with main job route)

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await context.params;

  // Check if job exists in store
  let job = jobStore.get(jobId);

  // For demo: simulate job progress if not exists
  if (!job) {
    job = {
      id: jobId,
      progress: 0,
      status: "processing",
      momentsFound: 0,
      estimatedSecondsRemaining: 300,
      createdAt: Date.now(),
    };
    jobStore.set(jobId, job);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial status immediately
      sendUpdate(controller, job);

      // Simulate progress updates every 500ms (per acceptance criteria)
      const intervalId = setInterval(() => {
        // Refresh job from store (in case other requests updated it)
        job = jobStore.get(jobId);

        if (job.status === "processing") {
          const elapsed = (Date.now() - job.createdAt) / 1000;

          // Simulate progress: ~30% per minute (0.5% per second)
          const newProgress = Math.min(95, Math.floor(elapsed * 0.5));

          if (newProgress !== job.progress) {
            job.progress = newProgress;
            job.estimatedSecondsRemaining = Math.max(0, 300 - elapsed);

            // Randomly find moments
            if (newProgress > 20 && job.momentsFound === 0) {
              job.momentsFound = Math.floor(Math.random() * 5) + 1;
            }
            if (newProgress > 60 && job.momentsFound < 3) {
              job.momentsFound = Math.floor(Math.random() * 8) + 3;
            }

            jobStore.set(jobId, job);
          }

          // Complete at 95% after 180 seconds
          if (newProgress >= 95 && elapsed > 180) {
            job.status = "complete";
            job.progress = 100;
            job.estimatedSecondsRemaining = 0;
            jobStore.set(jobId, job);
            sendUpdate(controller, job);
            clearInterval(intervalId);
            controller.close();
            return;
          }

          sendUpdate(controller, job);
        } else {
          sendUpdate(controller, job);
          clearInterval(intervalId);
          controller.close();
        }
      }, 500);

      // Handle client disconnect
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
      "Connection": "keep-alive",
    },
  });
}

function sendUpdate(controller: ReadableStreamDefaultController, data: any) {
  const payload = JSON.stringify({
    progress: data.progress,
    status: data.status,
    momentsFound: data.momentsFound,
    estimatedSecondsRemaining: data.estimatedSecondsRemaining,
  });
  controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
}
