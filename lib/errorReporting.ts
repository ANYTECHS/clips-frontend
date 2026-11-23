// Issue #1391 — tag Sentry events with the request ID.
//
// The app does not bundle a Sentry SDK directly, so this module talks to a
// Sentry-compatible client instead of importing one:
//   - a client registered with `registerErrorReporter(Sentry)` (call it from
//     `instrumentation.ts` / `sentry.*.config.ts` once the SDK is set up), or
//   - the global `Sentry` object exposed by the Sentry browser loader script.
// When neither is present every call is a no-op.

export const REQUEST_ID_TAG = "request_id";

interface SentryScopeLike {
  setTag(key: string, value: string): void;
}

export interface SentryLike {
  setTag?(key: string, value: string): void;
  withScope?(callback: (scope: SentryScopeLike) => void): void;
  captureException?(error: unknown, hint?: unknown): unknown;
}

let registered: SentryLike | null = null;

export function registerErrorReporter(client: SentryLike | null): void {
  registered = client;
}

function getReporter(): SentryLike | null {
  if (registered) return registered;
  const globalSentry = (globalThis as { Sentry?: SentryLike }).Sentry;
  return globalSentry ?? null;
}

/**
 * Tags the current Sentry scope with the request ID so any subsequent event
 * (including unhandled errors) carries it.
 */
export function setRequestIdTag(requestId: string | null | undefined): void {
  if (!requestId) return;
  getReporter()?.setTag?.(REQUEST_ID_TAG, requestId);
}

/**
 * Reports an error to Sentry with the request ID attached as a tag. The tag is
 * applied on an isolated scope so concurrent requests don't overwrite it.
 */
export function reportError(
  error: unknown,
  context: { requestId?: string | null; tags?: Record<string, string> } = {},
): void {
  const reporter = getReporter();
  if (!reporter?.captureException) return;

  const tags: Record<string, string> = { ...(context.tags ?? {}) };
  if (context.requestId) tags[REQUEST_ID_TAG] = context.requestId;

  try {
    if (reporter.withScope) {
      reporter.withScope((scope) => {
        for (const [key, value] of Object.entries(tags)) scope.setTag(key, value);
        reporter.captureException!(error);
      });
    } else {
      reporter.captureException(error, { tags });
    }
  } catch {
    // Error reporting must never break the request that triggered it.
  }
}
