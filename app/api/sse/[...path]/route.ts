import { NextRequest } from "next/server";
import { cookies } from "next/headers";

// Force dynamic so Next.js never caches this route
export const dynamic = "force-dynamic";
// No body size limit — SSE streams indefinitely
export const maxDuration = 300; // 5 min max on Vercel hobby; adjust as needed

// Graceful shutdown (issue #1397): track every open SSE stream so a
// SIGTERM/SIGINT can flush a terminal event to clients before the process
// exits.
const activeStreams = new Set<ReadableStreamDefaultController<Uint8Array>>();

function flushTerminalEvents(): void {
  // Terminal event: tells clients the stream is closing and that they should
  // reconnect to the new instance. The SSE `retry:` field is set to 1000ms.
  const terminalEvent =
    `event: closing\n` +
    `data: {"status":"shutting_down","message":"Server is shutting down — reconnect to the new instance."}\n` +
    `retry: 1000\n\n`;
  for (const controller of activeStreams) {
    try {
      controller.enqueue(new TextEncoder().encode(terminalEvent));
      controller.close();
    } catch {
      // Client disconnected or the stream is already closed.
    }
  }
  activeStreams.clear();
  // Give the terminal events a brief moment to flush, then exit so the
  // shutdown can proceed.
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGTERM", flushTerminalEvents);
process.on("SIGINT", flushTerminalEvents);

/**
 * Dedicated SSE proxy.
 *
 * Why a separate route instead of the generic /api/proxy?
 * The generic proxy uses NextResponse which buffers the response body in some
 * Next.js/Node.js configurations before flushing it. SSE requires each chunk
 * to be flushed immediately as it arrives.
 *
 * This route uses a native ReadableStream + WritableStream pair that
 * passes every chunk straight through to the browser without buffering.
 *
 * Usage: connect EventSource to /api/sse/events/processing-progress/:videoId
 * instead of /api/proxy/events/processing-progress/:videoId
 *
 * Graceful shutdown (issue #1397): on SIGTERM/SIGINT we flush a terminal
 * `closing` event to every open stream and then exit, so clients don't hang.
 * Clients should treat `closing` as "reconnect to the new instance" — the
 * event sets the SSE `retry:` field to 1000ms. Client-side reconnection
 * backoff: reconnect immediately on `closing`; if the new instance is not
 * ready yet, retry with exponential backoff starting at ~1s doubling to a
 * cap of ~10s.
 */
export async function GET(req: NextRequest) {
  const baseUrl = (process.env.API_URL || "https://clipcash-api.onrender.com").replace(/\/+$/, "");

  // Strip /api/sse prefix to get the real backend path
  const path = req.nextUrl.pathname.replace(/^\/api\/sse/, "");
  const search = req.nextUrl.search;
  const targetUrl = `${baseUrl}${path}${search}`;

  console.log(`[sse-proxy] → GET ${targetUrl}`);

  // Forward auth cookies and Authorization header
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const authHeader = req.headers.get("authorization");

  let backendRes: Response;
  try {
    backendRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      // Critical: tell fetch not to buffer the body
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("[sse-proxy] connection error:", err?.message);
    return new Response(
      `data: ${JSON.stringify({ status: "error", message: "Could not reach the processing server." })}\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  console.log(`[sse-proxy] ← backend responded ${backendRes.status}`);

  if (!backendRes.ok || !backendRes.body) {
    const errorText = await backendRes.text().catch(() => "");
    console.error("[sse-proxy] backend error:", backendRes.status, errorText);
    return new Response(
      `data: ${JSON.stringify({ status: "error", message: `Backend error ${backendRes.status}` })}\n\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  // Pipe the backend SSE stream straight through to the browser.
  // Each chunk is enqueued immediately (passthrough — no buffering), and the
  // stream is registered in activeStreams so the terminal event can be
  // flushed on graceful shutdown.
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
      activeStreams.add(c);
    },
    cancel: () => {
      if (controller) {
        activeStreams.delete(controller);
        controller = null;
      }
    },
  });
  backendRes.body.pipeTo(new WritableStream<Uint8Array>({
    write: (chunk) => {
      controller?.enqueue(chunk);
    },
    close: () => {
      controller?.close();
    },
    abort: (reason) => {
      try {
        controller?.error(reason);
      } catch {
        // Stream already closed.
      }
    },
  })).catch((err) => {
    console.warn("[sse-proxy] stream pipe ended:", err?.message);
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // disable nginx buffering
      Connection: "keep-alive",
      // Allow EventSource from the browser (same origin — no CORS needed)
    },
  });
}
