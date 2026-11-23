// Structured API request logging for the proxy routes (issue #1398).
//
// By default every proxied request is logged with its method, path, status
// and duration. Authorization, cookies and bodies are redacted — the log
// always shows `authorization=<redacted>` and `cookies=<redacted>`, and
// `body=<redacted>` unless a route has opted in to body logging via the
// API_LOG_BODY_PATHS env var (comma-separated route prefixes).

import { API_LOG_BODY_PREVIEW_CHARS } from "./constants";

const REDACTED = "<redacted>";

function bodyLogPaths(): string[] {
  return (process.env.API_LOG_BODY_PATHS || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function shouldLogBody(path: string): boolean {
  return bodyLogPaths().some(
    (p) => p && (path === p || path.startsWith(`${p}/`))
  );
}

export function logApiRequest(args: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  body?: string | null;
  logBody?: boolean;
}): void {
  const { method, path, status, durationMs, body } = args;
  const hasBody =
    args.logBody === true && typeof body === "string" && body.length > 0;
  const bodyPreview = hasBody ? body!.slice(0, API_LOG_BODY_PREVIEW_CHARS) : REDACTED;
  console.log(
    `[api] ${method} ${path} status=${status} durationMs=${durationMs} ` +
      `authorization=${REDACTED} cookies=${REDACTED} body=${bodyPreview}`
  );
}
