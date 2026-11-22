import { NextRequest, NextResponse } from "next/server";
import { validateMime } from "@/lib/mimeSniff";

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
    return NextResponse.json(
      { error: "Missing upload URL parameter." },
      { status: 400 }
    );
  }

  // Security check: ensure target host is an HTTPS R2 cloudflarestorage or r2.dev domain
  try {
    const parsed = new URL(uploadUrl);
    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "HTTPS is required for upload URL." },
        { status: 400 }
      );
    }
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".r2.cloudflarestorage.com") && !host.endsWith(".r2.dev")) {
      return NextResponse.json(
        { error: "Target URL host is not an allowed R2 storage endpoint." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid upload URL provided." },
      { status: 400 }
    );
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
      while (sniffed < 4100) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        sniffed += value.length;
      }
      head = new Uint8Array(Math.min(sniffed, 4100));
      let off = 0;
      for (const c of chunks) {
        const take = Math.min(c.length, head.length - off);
        head.set(c.subarray(0, take), off);
        off += take;
        if (off >= head.length) break;
      }
      const verdict = validateMime(contentType, head.subarray(0, 64));
      if (!verdict.ok) {
        await reader.cancel().catch(() => {});
        return NextResponse.json(
          { error: verdict.reason || "Uploaded file content does not match its declared type." },
          { status: 400 }
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
      console.error(`[r2-proxy] R2 returned ${res.status}:`, errText.slice(0, 200));
      return NextResponse.json(
        { error: `Cloudflare R2 rejected upload (${res.status}): ${errText.slice(0, 100)}` },
        { status: res.status }
      );
    }

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error("[r2-proxy] streaming error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to stream upload to Cloudflare R2." },
      { status: 500 }
    );
  }
}

