import { NextRequest } from "next/server";
import { YOUTUBE_PROXY_MAX_BYTES } from "@/lib/constants";
import { error, validationError } from "../apiResponse";
import { ERROR_CODES } from "../errorCodes";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube-dl?url=<encoded>
 *
 * Server-side streaming proxy for YouTube download URLs.
 *
 * Why this exists:
 *   YouTube CDN responses include restrictive CORS headers that block
 *   cross-origin fetch() calls from the browser. By fetching server-side
 *   and streaming the bytes back under our own origin, the browser can
 *   read the response as a Blob and hand it straight to the upload pipeline.
 *
 * Security:
 *   1. The `url` param must be a YouTube / Google Video CDN hostname.
 *      Any other domain is rejected with 400. This prevents the route
 *      from being used as a generic open proxy.
 *   2. The route carries no auth cookies outbound — it only fetches a
 *      publicly-signed YouTube CDN URL that was issued by our own backend.
 *   3. Content-type is verified to be video/* before streaming.
 *   4. Capped at 2 GB to stay within Vercel's response size limits.
 *
 * The caller (useYouTubeImport hook) is responsible for ensuring the URL
 * came from GET /videos/youtube-info/:videoId (JWT-protected, rate-limited).
 * This route itself is stateless and URL-only.
 */

const ALLOWED_HOSTS = [
  "googlevideo.com",
  "youtube.com",
  "ytimg.com",
  "yt3.ggpht.com",
];

function isAllowedYouTubeUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    if (protocol !== "https:") return false;
    const lowerHost = hostname.toLowerCase();
    return ALLOWED_HOSTS.some(
      (h) => lowerHost === h || lowerHost.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";

  if (!rawUrl) {
    return validationError({ url: "Missing url parameter." });
  }

  if (!isAllowedYouTubeUrl(rawUrl)) {
    return validationError({ url: "URL not permitted — only YouTube CDN URLs are accepted." });
  }

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, {
      headers: {
        // Mimic a real browser request so YouTube CDN doesn't reject us
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":          "video/webm,video/mp4,video/*,*/*;q=0.9",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://www.youtube.com/",
      },
    });
  } catch (err: any) {
    console.error("[youtube-dl] fetch error:", err?.message);
    return error("Could not reach YouTube CDN. Please try again.", 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  if (!upstream.ok) {
    return error(`YouTube CDN returned ${upstream.status}.`, 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("video/") && !contentType.startsWith("application/octet-stream")) {
    return error("Unexpected content type from YouTube CDN.", 415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  }

  if (!upstream.body) {
    return error("Empty response from YouTube CDN.", 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  // Stream through a byte counter that enforces the size cap
  let received = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > YOUTUBE_PROXY_MAX_BYTES) {
        controller.error(new Error("File exceeds the 2 GB size cap."));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const responseHeaders = new Headers({
    "Content-Type":  contentType || "video/mp4",
    "Cache-Control": "no-store",
    // Expose Content-Length to the browser so XHR onprogress works
    ...(upstream.headers.get("content-length")
      ? { "Content-Length": upstream.headers.get("content-length")! }
      : {}),
  });

  return new Response(upstream.body.pipeThrough(limiter), {
    status: 200,
    headers: responseHeaders,
  });
}
