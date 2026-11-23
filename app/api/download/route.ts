import { NextRequest } from "next/server";
import { DOWNLOAD_PROXY_MAX_BYTES } from "@/lib/constants";
import { error, validationError } from "../apiResponse";
import { ERROR_CODES } from "../errorCodes";

export const dynamic = "force-dynamic";

/**
 * GET /api/download?url=<encoded>&filename=<encoded>
 *
 * Secure server-side streaming proxy for Cloudinary (and any CDN) video files.
 *
 * Why this exists:
 *   The HTML `download` attribute is ignored by browsers for cross-origin URLs
 *   (e.g. res.cloudinary.com). By fetching the file on the server and streaming
 *   it back under our own origin with `Content-Disposition: attachment`, the
 *   browser always shows a Save dialog regardless of where the file is stored.
 *
 * Security measures:
 *   1. URL allowlist  — only Cloudinary URLs are accepted. Any other domain is
 *      rejected with 400. This prevents the route being used as an open proxy.
 *   2. No credentials — the outbound fetch carries no cookies or auth headers,
 *      so it cannot be used to exfiltrate authenticated resources.
 *   3. Content-Type   — only video/* and application/octet-stream are forwarded.
 *      HTML / JS responses from a spoofed URL are rejected with 415.
 *   4. Filename       — sanitised: only alphanumerics, spaces, hyphens, dots
 *      are kept. Defaults to "clip.mp4" if empty.
 *   5. Size cap       — streams are capped at DOWNLOAD_PROXY_MAX_BYTES (1 GB)
 *      to prevent memory abuse.
 */

const ALLOWED_HOSTS = [
  "res.cloudinary.com",
  "cloudinary.com",
  "r2.dev",
  "cloudflarestorage.com",
];

function sanitiseFilename(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9 ._\-()]/g, "").trim();
  return cleaned || "clip.mp4";
}

function isAllowedUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    if (protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (h) => hostname === h || hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawUrl      = searchParams.get("url")      ?? "";
  const rawFilename = searchParams.get("filename")  ?? "clip.mp4";

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!rawUrl) {
    return validationError({ url: "Missing url parameter." });
  }

  if (!isAllowedUrl(rawUrl)) {
    return validationError({
      url: "URL not permitted — only Cloudinary assets may be downloaded via this route.",
    });
  }

  const filename = sanitiseFilename(rawFilename);

  // ── Fetch from CDN ──────────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, {
      headers: { "User-Agent": "ClipCash-Download-Proxy/1.0" },
      // No cookies, no auth — intentionally unauthenticated outbound request
    });
  } catch (err: any) {
    console.error("[download-proxy] fetch error:", err?.message);
    return error("Could not reach the file server. Please try again.", 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  if (!upstream.ok) {
    return error(`File server returned ${upstream.status}`, 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  // ── Validate content type ───────────────────────────────────────────────────
  const contentType = upstream.headers.get("content-type") ?? "";
  const allowed =
    contentType.startsWith("video/") ||
    contentType.startsWith("application/octet-stream") ||
    contentType.startsWith("binary/");

  if (!allowed) {
    return error(
      "Unexpected content type — only video files are allowed.",
      415,
      ERROR_CODES.UNSUPPORTED_MEDIA_TYPE
    );
  }

  // ── Stream to browser ───────────────────────────────────────────────────────
  // ReadableStream.pipeThrough limits memory — the file is never fully buffered.
  if (!upstream.body) {
    return error("Empty response from file server.", 502, ERROR_CODES.UPSTREAM_ERROR);
  }

  // Enforce the size cap by counting bytes through a TransformStream
  let bytesReceived = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesReceived += chunk.byteLength;
      if (bytesReceived > DOWNLOAD_PROXY_MAX_BYTES) {
        controller.error(new Error("File exceeds the 1 GB size cap."));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  const stream = upstream.body.pipeThrough(limiter);

  const headers = new Headers({
    // Forces browser Save dialog on all browsers regardless of file origin
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Type": contentType || "video/mp4",
    // Forward length if available so the browser can show download progress
    ...(upstream.headers.get("content-length")
      ? { "Content-Length": upstream.headers.get("content-length")! }
      : {}),
    // No caching — download URLs from Cloudinary are often signed & short-lived
    "Cache-Control": "no-store",
  });

  return new Response(stream, { status: 200, headers });
}
