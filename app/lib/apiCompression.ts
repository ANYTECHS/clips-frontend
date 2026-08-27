/**
 * app/lib/apiCompression.ts
 *
 * API response/request compression middleware — Issue #897.
 *
 * Implements:
 *   • Response compression  — gzip / deflate / identity (via CompressionStream)
 *   • Request decompression — gzip / deflate body decompression (via DecompressionStream)
 *   • Compression bypass    — skips tiny payloads (< MIN_COMPRESS_BYTES) and
 *     already-compressed content types (images, video, audio, zip, etc.)
 *   • Configurable min-size threshold (default 1 KB)
 *
 * Usage — response compression:
 *   import { compressResponse } from "@/app/lib/apiCompression";
 *
 *   export async function GET(req: NextRequest) {
 *     const data = await buildLargePayload();
 *     const response = NextResponse.json(data);
 *     return compressResponse(req, response);
 *   }
 *
 * Usage — request body decompression:
 *   import { decompressRequestBody } from "@/app/lib/apiCompression";
 *
 *   export async function POST(req: NextRequest) {
 *     const { body, error } = await decompressRequestBody(req);
 *     if (error) return error;
 *     // body is a plain string; parse it as JSON if needed
 *   }
 *
 * Compression config can be overridden via environment variables:
 *   COMPRESSION_ENABLED          — "true" | "false"  (default: "true")
 *   COMPRESSION_MIN_BYTES        — integer bytes      (default: 1024)
 *   COMPRESSION_LEVEL            — "fast" | "default" | "best"  (informational only; not
 *                                   directly supported by CompressionStream)
 *
 * Note on Next.js & edge runtimes:
 *   Next.js applies gzip automatically at the infrastructure level when deployed
 *   to Vercel or behind a CDN.  This module is most useful for self-hosted
 *   Node.js deployments and for API routes that bypass Next.js's static
 *   response caching (e.g. streaming routes, dynamic JSON endpoints).
 *   CompressionStream / DecompressionStream are available in Node ≥ 18 and all
 *   major browsers.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface CompressionConfig {
  /** Enable/disable compression globally. Defaults to `true`. */
  enabled: boolean;
  /**
   * Minimum response body size in bytes before compression is applied.
   * Responses smaller than this are returned as-is to avoid the overhead of
   * compressing tiny payloads.  Default: 1024 bytes (1 KB).
   */
  minBytes: number;
}

function resolveConfig(): CompressionConfig {
  const enabled = process.env.COMPRESSION_ENABLED !== "false";
  const minBytes = process.env.COMPRESSION_MIN_BYTES
    ? parseInt(process.env.COMPRESSION_MIN_BYTES, 10)
    : 1024;
  return { enabled, minBytes };
}

let _config: CompressionConfig | null = null;

/** Memoised config — re-reads env on the first call each process lifetime. */
function getConfig(): CompressionConfig {
  if (_config) return _config;
  _config = resolveConfig();
  return _config;
}

// ─── Content-type bypass list ─────────────────────────────────────────────────

/**
 * MIME type prefixes and exact types for content that is already compressed or
 * where compression provides no benefit.  Matching responses are always passed
 * through unmodified.
 */
const BYPASS_CONTENT_TYPES = new Set([
  "image/",
  "video/",
  "audio/",
  "application/zip",
  "application/gzip",
  "application/x-gzip",
  "application/x-brotli",
  "application/x-br",
  "application/zstd",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/octet-stream",
]);

function shouldBypassContentType(contentType: string): boolean {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  for (const prefix of BYPASS_CONTENT_TYPES) {
    if (ct === prefix || ct.startsWith(prefix)) return true;
  }
  return false;
}

// ─── Encoding negotiation ─────────────────────────────────────────────────────

type SupportedEncoding = "gzip" | "deflate" | "identity";

/**
 * Parses the `Accept-Encoding` header and returns the best encoding that this
 * module supports, or `identity` if none match.
 */
function negotiateEncoding(request: NextRequest): SupportedEncoding {
  const acceptEncoding = request.headers.get("accept-encoding") ?? "";

  // Simple q-value-aware negotiation for gzip and deflate.
  const entries = acceptEncoding
    .split(",")
    .map((part) => {
      const [enc, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.replace(/q\s*=\s*/, "")) : 1;
      return { enc: enc.trim().toLowerCase(), q: isNaN(q) ? 1 : q };
    })
    .filter((e) => e.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { enc } of entries) {
    if (enc === "gzip") return "gzip";
    if (enc === "deflate") return "deflate";
    if (enc === "identity" || enc === "*") return "identity";
  }
  return "identity";
}

// ─── Compression helpers ──────────────────────────────────────────────────────

type CompressionFormat = "gzip" | "deflate";

async function compressBuffer(
  input: Uint8Array,
  format: CompressionFormat
): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    // CompressionStream not available (old Node) — return as-is.
    return input;
  }
  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  writer.write(input);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function decompressBuffer(
  input: Uint8Array,
  format: CompressionFormat
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    return input;
  }
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(input);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ─── Public API — response compression ───────────────────────────────────────

/**
 * Optionally compresses a `NextResponse` body based on the client's
 * `Accept-Encoding` header and the response content type.
 *
 * Returns the original response unchanged when:
 *   - Compression is disabled via config
 *   - The client doesn't accept a supported encoding
 *   - The response body is below the minimum size threshold
 *   - The content type is already compressed (images, video, …)
 *
 * @param request  The incoming `NextRequest` (used to read `Accept-Encoding`).
 * @param response The `NextResponse` whose body may be compressed.
 * @returns        A (potentially compressed) `NextResponse`.
 */
export async function compressResponse(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  const config = getConfig();
  if (!config.enabled) return response;

  // Don't compress responses that already carry a Content-Encoding.
  if (response.headers.get("content-encoding")) return response;

  const encoding = negotiateEncoding(request);
  if (encoding === "identity") return response;

  const contentType = response.headers.get("content-type") ?? "";
  if (shouldBypassContentType(contentType)) return response;

  // Clone the body so we can inspect its size before deciding.
  const bodyBuffer = await response.arrayBuffer();
  const bodyBytes = new Uint8Array(bodyBuffer);

  if (bodyBytes.length < config.minBytes) {
    // Body is small — recreate the response with the original body untouched.
    return new NextResponse(bodyBytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  let compressed: Uint8Array;
  try {
    compressed = await compressBuffer(bodyBytes, encoding as CompressionFormat);
  } catch {
    // Compression failed — return original body.
    return new NextResponse(bodyBytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const headers = new Headers(response.headers);
  headers.set("content-encoding", encoding);
  headers.set("content-length", String(compressed.length));
  // Vary tells downstream caches not to serve a compressed response to a
  // client that didn't send Accept-Encoding.
  const existing = headers.get("vary");
  if (!existing) {
    headers.set("vary", "Accept-Encoding");
  } else if (!existing.toLowerCase().includes("accept-encoding")) {
    headers.set("vary", `${existing}, Accept-Encoding`);
  }

  return new NextResponse(compressed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ─── Public API — request decompression ──────────────────────────────────────

export interface DecompressResult {
  /** Decompressed body as a UTF-8 string, or null on error. */
  body: string | null;
  /** Non-null when decompression failed — use as the route error response. */
  error: NextResponse | null;
}

/**
 * Decompresses the body of an incoming request if it carries a
 * `Content-Encoding: gzip` or `Content-Encoding: deflate` header.
 *
 * Returns the body as a plain string so the caller can JSON.parse it or
 * handle it as text.  Returns `{ body: null, error: NextResponse }` if
 * decompression fails so the route can return a 400.
 *
 * Requests without a `Content-Encoding` header are passed through unchanged
 * (body is read directly as text).
 *
 * @param request  The incoming `NextRequest`.
 * @param maxBytes Maximum decompressed body size (default: 10 MB).
 */
export async function decompressRequestBody(
  request: NextRequest,
  maxBytes = 10 * 1024 * 1024
): Promise<DecompressResult> {
  const contentEncoding = request.headers.get("content-encoding")?.toLowerCase() ?? "";

  if (!contentEncoding || contentEncoding === "identity") {
    try {
      const body = await request.text();
      if (body.length > maxBytes) {
        return {
          body: null,
          error: NextResponse.json({ error: "Request body too large" }, { status: 413 }),
        };
      }
      return { body, error: null };
    } catch {
      return {
        body: null,
        error: NextResponse.json({ error: "Failed to read request body" }, { status: 400 }),
      };
    }
  }

  const format: CompressionFormat | null =
    contentEncoding === "gzip" ? "gzip" :
    contentEncoding === "deflate" ? "deflate" :
    null;

  if (!format) {
    return {
      body: null,
      error: NextResponse.json(
        { error: `Unsupported Content-Encoding: ${contentEncoding}` },
        { status: 415 }
      ),
    };
  }

  try {
    const rawBuffer = await request.arrayBuffer();
    const rawBytes = new Uint8Array(rawBuffer);
    const decompressed = await decompressBuffer(rawBytes, format);

    if (decompressed.length > maxBytes) {
      return {
        body: null,
        error: NextResponse.json({ error: "Decompressed body too large" }, { status: 413 }),
      };
    }

    const body = new TextDecoder().decode(decompressed);
    return { body, error: null };
  } catch {
    return {
      body: null,
      error: NextResponse.json({ error: "Failed to decompress request body" }, { status: 400 }),
    };
  }
}

/**
 * Resets the memoised config.  Used in tests to pick up env variable changes.
 * @internal
 */
export function __resetCompressionConfig(): void {
  _config = null;
}
