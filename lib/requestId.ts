// Issue #1391 — per-request correlation IDs.
//
// The middleware (proxy.ts) generates a request ID for every request, forwards
// it to route handlers via the `x-request-id` request header and echoes it on
// the response. Route handlers resolve the same ID with `resolveRequestId` so
// error envelopes, logs and Sentry events can all be correlated.
//
// Framework-agnostic (Web `Headers` / `Response` + `crypto.randomUUID`), so it
// runs in the Edge middleware runtime, Node route handlers and the browser.

export const REQUEST_ID_HEADER = "x-request-id";

// Accept upstream IDs (load balancers, the backend, retries) only when they
// look like an opaque token — never reflect arbitrary header content.
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function isValidRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && VALID_REQUEST_ID.test(value);
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Returns the request ID carried by `headers` (set by the middleware or an
 * upstream proxy) or generates a fresh one.
 */
export function resolveRequestId(headers: Headers): string {
  const incoming = headers.get(REQUEST_ID_HEADER);
  return isValidRequestId(incoming) ? incoming : generateRequestId();
}

/** Sets the `x-request-id` header on a (mutable) response and returns it. */
export function withRequestId<T extends Response>(res: T, requestId: string): T {
  try {
    res.headers.set(REQUEST_ID_HEADER, requestId);
  } catch {
    // Immutable headers (e.g. Response.redirect) — nothing we can do here.
  }
  return res;
}
