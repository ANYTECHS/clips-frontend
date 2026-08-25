import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSSEHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  } as Record<string, string>;
}

export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        const chunk = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      // Initial stats
      send({ type: "stats", data: { earnings: 0, clips: 0, platforms: 0 } });

      // Heartbeat every 30s
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", ts: Date.now() });
      }, 30000);

      // Simulated updates
      const updateInterval = setInterval(() => {
        send({
          type: "stats",
          data: {
            earnings: parseFloat((Math.random() * 1000).toFixed(2)),
            clips: Math.floor(Math.random() * 100),
            platforms: Math.floor(Math.random() * 8) + 1,
          },
        });
      }, 5000);

      req.signal.addEventListener("aborted", () => {
        clearInterval(heartbeat);
        clearInterval(updateInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, { headers: getSSEHeaders() });
}