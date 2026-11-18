import { NextRequest } from "next/server";
import { cookies } from "next/headers";

// Force dynamic so Next.js never caches this route
export const dynamic = "force-dynamic";
// No body size limit — SSE streams indefinitely
export const maxDuration = 300; // 5 min max on Vercel hobby; adjust as needed

/**
 * Dedicated SSE proxy.
 *
 * Why a separate route instead of the generic /api/proxy?
 * The generic proxy uses NextResponse which buffers the response body in some
 * Next.js/Node.js configurations before flushing it. SSE requires each chunk
 * to be flushed immediately as it arrives.
 *
 * This route uses a native ReadableStream + TransformStream pipeline that
 * passes every chunk straight through to the browser without buffering.
 *
 * Usage: connect EventSource to /api/sse/events/processing-progress/:videoId
 * instead of /api/proxy/events/processing-progress/:videoId
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
  // TransformStream is a passthrough — each chunk is flushed immediately.
  const { readable, writable } = new TransformStream();
  backendRes.body.pipeTo(writable).catch((err) => {
    console.warn("[sse-proxy] stream pipe ended:", err?.message);
  });

  return new Response(readable, {
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
