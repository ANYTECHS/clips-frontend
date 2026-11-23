import { NextRequest } from "next/server";
import { validateMime } from "@/lib/mimeSniff";
import {
  MIME_SNIFF_BUFFER_BYTES,
  MIME_SNIFF_HEADER_BYTES,
  R2_ERROR_LOG_CHARS,
  R2_ERROR_MESSAGE_CHARS,
} from "@/lib/constants";
import { empty, error, handleError, validationError } from "../apiResponse";
import { ERROR_CODES } from "../errorCodes";

export const dynamic = "force-dynamic";

/**
 * Fallback streaming proxy for Cloudflare R2 uploads.
 *
 * When a user's browser origin (e.g. 127.0.0.1:3000, private IP, or deployment domain)
 * is rejected by Cloudflare R2's CORS preflight policy, this route proxies the PUT request
 * server-side so the upload succeeds without CORS errors.
 */
export async function PUT(req: NextRequest) {
  const uploadUrl = req.nextUrl.searchParams.get("url");

  if (!uploadUrl) {
    return validationError({ url: "Missing upload URL parameter." });
  }

  // Security check: ensure target host is an HTTPS R2 cloudflarestorage or r2.dev domain
  try {
    const parsed = new URL(uploadUrl);
    if (parsed.protocol !== "https:") {
      return validationError({ url: "HTTPS is required for upload URL." });
    }
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".r2.cloudflarestorage.com") && !host.endsWith(".r2.dev")) {
      return error(
        "Target URL host is not an allowed R2 storage endpoint.",
        403,
        ERROR_CODES.FORBIDDEN
      );
    }
  } catch {
    return validationError({ url: "Invalid upload URL provided." });
  }

  try {
    const contentType = req.headers.get("content-type") || "video/mp4";

    // Issue #1367 — sniff magic bytes before proxying. Client Content-Type is
    // spoofable; we compare the payload's real signature against the declared
    // type and reject mismatches (including renamed executables/scripts).
    let upstreamBody: ReadableStream<Uint8Array> | null = req.body;
    if (req.body) {
      const reader = req.body.getReader();
      const chunks: Uint8Array[] = [];
      let sniffed = 0;
      let head = new Uint8Array(0);
      // Buffer enough bytes for magic-byte detection (<= 64 bytes needed).
      while (sniffed < MIME_SNIFF_BUFFER_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        sniffed += value.length;
      }
      head = new Uint8Array(Math.min(sniffed, MIME_SNIFF_BUFFER_BYTES));
      let off = 0;
      for (const c of chunks) {
        const take = Math.min(c.length, head.length - off);
        head.set(c.subarray(0, take), off);
        off += take;
        if (off >= head.length) break;
      }
      const verdict = validateMime(contentType, head.subarray(0, MIME_SNIFF_HEADER_BYTES));
      if (!verdict.ok) {
        await reader.cancel().catch(() => {});
        return error(
          verdict.reason || "Uploaded file content does not match its declared type.",
          400,
          ERROR_CODES.UNSUPPORTED_MEDIA_TYPE
        );
      }
      // Rebuild the stream: peeked chunks first, then the remainder.
      const peeked = chunks;
      const rest = reader;
      const rebuilt = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (peeked.length) {
            controller.enqueue(peeked.shift()!);
            return;
          }
          const { done, value } = await rest.read();
          if (done) controller.close();
          else if (value) controller.enqueue(value);
        },
        cancel(reason) {
          void rest.cancel(reason);
        },
      });
      upstreamBody = rebuilt;
    }

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: upstreamBody,
      // duplex: 'half' is required for Node.js fetch with a streaming request body
      duplex: "half",
    } as any);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[r2-proxy] R2 returned ${res.status}:`, errText.slice(0, R2_ERROR_LOG_CHARS));
      return error(
        `Cloudflare R2 rejected upload (${res.status}): ${errText.slice(0, R2_ERROR_MESSAGE_CHARS)}`,
        res.status,
        ERROR_CODES.UPSTREAM_ERROR
      );
    }

    return empty(200);
  } catch (err) {
    return handleError(err, "[r2-proxy] streaming error");
  }
}

