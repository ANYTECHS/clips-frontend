/**
 * app/lib/apiCompression.ts
 *
 * API response/request compression — Issue #1250.
 *
 * Implements:
 *   • Brotli compression (`br`) where supported and negotiated by client.
 *   • Gzip compression (`gzip`) as fallback.
 *   • Deflate compression (`deflate`) as secondary fallback.
 *   • Parsing of `Accept-Encoding` quality values (`q`) and `q=0` exclusions.
 *   • Configurable compression levels:
 *       - Brotli default: 4 (via `zlib.constants.BROTLI_PARAM_QUALITY`)
 *       - Gzip default: 6
 *   • Byte threshold: compresses only responses strictly larger than 1024 bytes (> 1 KB).
 *   • Excludes SSE (`text/event-stream`), already compressed content, 204/304/HEAD.
 *   • Merges `Vary: Accept-Encoding` and updates `Content-Length`.
 */

import { NextRequest, NextResponse } from "next/server";
import * as zlib from "zlib";
import { promisify } from "util";

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);
const deflateAsync = promisify(zlib.deflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);
const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);

// ─── Configuration ────────────────────────────────────────────────────────────

export interface CompressionConfig {
  /** Enable/disable compression globally. Defaults to `true`. */
  enabled: boolean;
  /**
   * Minimum response body size in bytes before compression is applied.
   * Responses smaller than or equal to this threshold are passed through uncompressed.
   * Default: 1024 bytes (1 KB boundary rule).
   */
  minBytes: number;
  /** Brotli compression quality level (0–11). Default: 4. */
  brotliLevel: number;
  /** Gzip compression level (1–9). Default: 6. */
  gzipLevel: number;
}

export const DEFAULT_COMPRESSION_MIN_BYTES = 1024;
export const DEFAULT_BROTLI_LEVEL = 4;
export const DEFAULT_GZIP_LEVEL = 6;

function resolveConfig(): CompressionConfig {
  const enabled = process.env.COMPRESSION_ENABLED !== "false";
  const minBytes = process.env.COMPRESSION_MIN_BYTES
    ? parseInt(process.env.COMPRESSION_MIN_BYTES, 10)
    : DEFAULT_COMPRESSION_MIN_BYTES;
  const brotliLevel = process.env.BROTLI_COMPRESSION_LEVEL
    ? parseInt(process.env.BROTLI_COMPRESSION_LEVEL, 10)
    : DEFAULT_BROTLI_LEVEL;
  const gzipLevel = process.env.GZIP_COMPRESSION_LEVEL
    ? parseInt(process.env.GZIP_COMPRESSION_LEVEL, 10)
    : DEFAULT_GZIP_LEVEL;

  return {
    enabled,
    minBytes: isNaN(minBytes) ? DEFAULT_COMPRESSION_MIN_BYTES : minBytes,
    brotliLevel: isNaN(brotliLevel) ? DEFAULT_BROTLI_LEVEL : Math.min(11, Math.max(0, brotliLevel)),
    gzipLevel: isNaN(gzipLevel) ? DEFAULT_GZIP_LEVEL : Math.min(9, Math.max(1, gzipLevel)),
  };
}

let _config: CompressionConfig | null = null;

export function getCompressionConfig(): CompressionConfig {
  if (_config) return _config;
  _config = resolveConfig();
  return _config;
}

export function __resetCompressionConfig(): void {
  _config = null;
}

// ─── Content-type bypass list ─────────────────────────────────────────────────

const BYPASS_CONTENT_TYPES = new Set([
  "text/event-stream",
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
  "application/pdf",
]);

export function shouldBypassContentType(contentType: string): boolean {
  if (!contentType) return false;
  const ct = contentType.split(";")[0].trim().toLowerCase();
  for (const prefix of BYPASS_CONTENT_TYPES) {
    if (ct === prefix || ct.startsWith(prefix)) return true;
  }
  return false;
}

// ─── Encoding negotiation ─────────────────────────────────────────────────────

export type SupportedEncoding = "br" | "gzip" | "deflate" | "identity";

interface EncodingPreference {
  encoding: string;
  q: number;
  order: number;
}

/**
 * Parses the `Accept-Encoding` header taking into account quality values (`q`)
 * and explicit exclusions (`q=0`).
 *
 * Resolution rules:
 *   - Brotli (`br`) is preferred over gzip when q values are equal or unspecified.
 *   - If client explicitly sets higher q for gzip (e.g. `gzip;q=1, br;q=0.5`), gzip is chosen.
 *   - If an encoding is set to `q=0`, it is eliminated.
 *   - If wildcard `*` has `q=0`, only explicitly permitted encodings with `q>0` are considered.
 *   - Returns `identity` if no supported compressed encoding is acceptable.
 */
export function negotiateEncoding(acceptEncodingHeader: string | null | undefined): SupportedEncoding {
  if (!acceptEncodingHeader || typeof acceptEncodingHeader !== "string") {
    return "identity";
  }

  const parts = acceptEncodingHeader.split(",");
  const entries: EncodingPreference[] = [];

  let wildcardQ: number | null = null;

  parts.forEach((part, index) => {
    const [rawEnc, ...rawParams] = part.trim().split(";");
    const enc = rawEnc.trim().toLowerCase();
    if (!enc) return;

    let q = 1.0;
    for (const param of rawParams) {
      const match = param.trim().match(/^q\s*=\s*([0-9.]+)/i);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed)) {
          q = parsed;
        }
      }
    }

    if (enc === "*") {
      wildcardQ = q;
    } else {
      entries.push({ encoding: enc, q, order: index });
    }
  });

  const getQ = (encoding: string): number => {
    const entry = entries.find((e) => e.encoding === encoding);
    if (entry) return entry.q;
    if (wildcardQ !== null) return wildcardQ;
    return encoding === "identity" ? 0.0001 : 0;
  };

  const brQ = getQ("br");
  const gzipQ = getQ("gzip");
  const deflateQ = getQ("deflate");
  const identityQ = getQ("identity");

  const candidates: { encoding: SupportedEncoding; q: number; priority: number }[] = [
    { encoding: "br" as const, q: brQ, priority: 3 },
    { encoding: "gzip" as const, q: gzipQ, priority: 2 },
    { encoding: "deflate" as const, q: deflateQ, priority: 1 },
  ].filter((c): c is { encoding: SupportedEncoding; q: number; priority: number } => c.q > 0);

  if (candidates.length === 0) {
    return "identity";
  }

  // Sort descending by q. If q is equal, sort by priority (br > gzip > deflate).
  candidates.sort((a, b) => {
    if (Math.abs(b.q - a.q) > 0.0001) {
      return b.q - a.q;
    }
    return b.priority - a.priority;
  });

  const best = candidates[0];
  // If identity was given higher priority than any compressed candidate, respect it
  if (identityQ > best.q) {
    return "identity";
  }

  return best.encoding;
}

// ─── Buffer Compression / Decompression ───────────────────────────────────────

export async function compressBuffer(
  input: Uint8Array,
  encoding: SupportedEncoding,
  config?: CompressionConfig
): Promise<Uint8Array> {
  const conf = config ?? getCompressionConfig();
  const nodeBuf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  if (encoding === "br") {
    const compressed = await brotliCompressAsync(nodeBuf, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: conf.brotliLevel,
      },
    });
    return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
  }

  if (encoding === "gzip") {
    const compressed = await gzipAsync(nodeBuf, {
      level: conf.gzipLevel,
    });
    return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
  }

  if (encoding === "deflate") {
    const compressed = await deflateAsync(nodeBuf, {
      level: conf.gzipLevel,
    });
    return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
  }

  return input;
}

export async function decompressBuffer(
  input: Uint8Array,
  encoding: SupportedEncoding
): Promise<Uint8Array> {
  const nodeBuf = Buffer.from(input.buffer, input.byteOffset, input.byteLength);

  if (encoding === "br") {
    const decompressed = await brotliDecompressAsync(nodeBuf);
    return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  }

  if (encoding === "gzip") {
    const decompressed = await gunzipAsync(nodeBuf);
    return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  }

  if (encoding === "deflate") {
    const decompressed = await inflateAsync(nodeBuf);
    return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  }

  return input;
}

// ─── Public API — response compression ───────────────────────────────────────

/**
 * Compresses a `NextResponse` body based on request `Accept-Encoding`.
 *
 * Rules:
 *   - Skips when compression is disabled.
 *   - Skips responses with status 204, 304, or HEAD requests.
 *   - Skips when response already has `Content-Encoding`.
 *   - Skips when content-type is SSE (`text/event-stream`) or already compressed.
 *   - Skips bodies <= minBytes (default 1024 bytes).
 *   - Applies negotiated encoding (Brotli or Gzip).
 *   - Merges `Vary: Accept-Encoding` and updates `Content-Length`.
 */
export async function compressResponse(
  request: NextRequest,
  response: NextResponse,
  customConfig?: Partial<CompressionConfig>
): Promise<NextResponse> {
  const baseConfig = getCompressionConfig();
  const config: CompressionConfig = { ...baseConfig, ...customConfig };

  if (!config.enabled) return response;

  // Responses without bodies (204 No Content, 304 Not Modified, HEAD)
  if (response.status === 204 || response.status === 304 || request.method === "HEAD") {
    return response;
  }

  // Already carrying a Content-Encoding
  if (response.headers.get("content-encoding")) {
    return response;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (shouldBypassContentType(contentType)) {
    return response;
  }

  const acceptEncoding = request.headers.get("accept-encoding");
  const encoding = negotiateEncoding(acceptEncoding);
  if (encoding === "identity") {
    return response;
  }

  // Clone and read the response body as arrayBuffer
  let bodyBytes: Uint8Array;
  try {
    const bodyBuffer = await response.arrayBuffer();
    bodyBytes = new Uint8Array(bodyBuffer);
  } catch {
    // If reading body fails (e.g. opaque or locked stream), return original response untouched
    return response;
  }

  // Boundary check: body must be strictly larger than minBytes (> 1024 bytes)
  if (bodyBytes.length <= config.minBytes) {
    return new NextResponse(bodyBytes as unknown as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  let compressed: Uint8Array;
  try {
    compressed = await compressBuffer(bodyBytes, encoding, config);
  } catch {
    // Compression failed — return original body untouched
    return new NextResponse(bodyBytes as unknown as BodyInit, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const headers = new Headers(response.headers);
  headers.set("content-encoding", encoding);
  headers.set("content-length", String(compressed.length));

  // Merge Vary header with Accept-Encoding
  const existingVary = headers.get("vary");
  if (!existingVary) {
    headers.set("vary", "Accept-Encoding");
  } else if (!existingVary.toLowerCase().split(",").map((v) => v.trim()).includes("accept-encoding")) {
    headers.set("vary", `${existingVary}, Accept-Encoding`);
  }

  return new NextResponse(compressed as unknown as BodyInit, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ─── Public API — request decompression ──────────────────────────────────────

export interface DecompressResult {
  body: string | null;
  error: NextResponse | null;
}

export async function decompressRequestBody(
  request: NextRequest,
  maxBytes = 10 * 1024 * 1024
): Promise<DecompressResult> {
  const contentEncoding = request.headers.get("content-encoding")?.toLowerCase().trim() ?? "";

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

  if (contentEncoding !== "gzip" && contentEncoding !== "deflate" && contentEncoding !== "br") {
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
    const decompressed = await decompressBuffer(rawBytes, contentEncoding as SupportedEncoding);

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
