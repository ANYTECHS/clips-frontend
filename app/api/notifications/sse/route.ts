import { NextRequest } from "next/server";
import { notificationStore } from "../notificationStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") || "default_user";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", userId })}\n\n`)
      );

      // Send current unread notifications
      try {
        const unread = await notificationStore.getUnread(userId);
        if (unread.length > 0) {
          controller.enqueue(
            encoder.encode(`event: notifications\ndata: ${JSON.stringify(unread)}\n\n`)
          );
        }
      } catch {
        // Continue even if initial load fails
      }

      // Interval for keepalive and polling new notifications
      let lastCheck = Date.now();
      const interval = setInterval(async () => {
        try {
          // Send keepalive comment
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));

          // Check if new notifications arrived
          const all = await notificationStore.getAll(userId);
          const newItems = all.filter(
            (item) => new Date(item.createdAt).getTime() > lastCheck
          );

          if (newItems.length > 0) {
            for (const item of newItems) {
              controller.enqueue(
                encoder.encode(`event: notification\ndata: ${JSON.stringify(item)}\n\n`)
              );
            }
          }
          lastCheck = Date.now();
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 10000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Controller might already be closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
