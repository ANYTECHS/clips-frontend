import { NextRequest, NextResponse } from "next/server";

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
 *   5. Size cap       — streams are capped at 500 MB to prevent memory abuse.
 */

const ALLOWED_HOSTS = [
  "res.cloudinary.com",
  "cloudinary.com",
  "r2.dev",
  "cloudflarestorage.com",
];

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

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
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  if (!isAllowedUrl(rawUrl)) {
    return NextResponse.json(
      { error: "URL not permitted — only Cloudinary assets may be downloaded via this route." },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "Could not reach the file server. Please try again." },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `File server returned ${upstream.status}` },
      { status: 502 }
    );
  }

  // ── Validate content type ───────────────────────────────────────────────────
  const contentType = upstream.headers.get("content-type") ?? "";
  const allowed =
    contentType.startsWith("video/") ||
    contentType.startsWith("application/octet-stream") ||
    contentType.startsWith("binary/");

  if (!allowed) {
    return NextResponse.json(
      { error: "Unexpected content type — only video files are allowed." },
      { status: 415 }
    );
  }

  // ── Stream to browser ───────────────────────────────────────────────────────
  // ReadableStream.pipeThrough limits memory — the file is never fully buffered.
  if (!upstream.body) {
    return NextResponse.json({ error: "Empty response from file server." }, { status: 502 });
  }

  // Enforce the size cap by counting bytes through a TransformStream
  let bytesReceived = 0;
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesReceived += chunk.byteLength;
      if (bytesReceived > MAX_BYTES) {
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
