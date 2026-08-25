/**
 * parseRequestJson — parses a request's JSON body while enforcing a maximum
 * payload size, so a large body can't exhaust memory or slow down parsing.
 *
 * Prefer this over calling `request.json()` directly in any POST/PATCH route.
 */

import { NextRequest, NextResponse } from "next/server";

const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MB

export type ParseRequestJsonResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

function tooLargeResponse(): NextResponse {
  return NextResponse.json({ error: "Request too large" }, { status: 413 });
}

function invalidJsonResponse(): NextResponse {
  return NextResponse.json(
    { error: "Invalid or malformed JSON payload" },
    { status: 400 }
  );
}

export async function parseRequestJson<T = unknown>(
  request: NextRequest | Request,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<ParseRequestJsonResult<T>> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, response: tooLargeResponse() };
  }

  if (!request.body) {
    try {
      const body = (await request.json()) as T;
      return { ok: true, body };
    } catch {
      return { ok: false, response: invalidJsonResponse() };
    }
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return { ok: false, response: tooLargeResponse() };
    }

    chunks.push(value);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(combined);

  try {
    const body = (text ? JSON.parse(text) : {}) as T;
    return { ok: true, body };
  } catch {
    return { ok: false, response: invalidJsonResponse() };
  }
}
