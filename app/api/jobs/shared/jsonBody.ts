import { NextRequest, NextResponse } from "next/server";

export function validateJsonContentType(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 400 }
    );
  }
  return null;
}

export async function parseJsonRequest<T = unknown>(
  request: NextRequest
): Promise<
  | { ok: true; body: T }
  | { ok: false; response: NextResponse }
> {
  const headerError = validateJsonContentType(request);
  if (headerError) {
    return { ok: false, response: headerError };
  }

  try {
    const body = await request.json();
    return { ok: true, body: body as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or malformed JSON payload" },
        { status: 400 }
      ),
    };
  }
}
