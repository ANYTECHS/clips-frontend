# API Timeout Policy

## Requirements

- Standard API routes have a 10-second wall-clock deadline covering authentication and route execution.
- The default is configurable with the positive `API_TIMEOUT_MS` environment variable.
- Individual routes may set `timeoutMs` in `withApiMiddleware`; use `timeoutMs: false` only for long-lived streaming responses.
- A deadline returns HTTP `504 Gateway Timeout` with `{ "error": "Request timed out", "code": "TIMEOUT" }`.
- Timeout responses include `Retry-After: 1`. Clients may retry idempotent requests, using normal backoff and avoiding automatic retries for non-idempotent operations unless the operation is idempotent by design.
- The timeout does not cancel work already running in the JavaScript runtime. Handlers that call external services should use their own abort/deadline support where available.

## Route usage

```ts
export const GET = withApiMiddleware(handler, { requireAuth: false });

// Server-sent events and other intentionally long-lived responses:
export const GET = withApiMiddleware(handler, {
  requireAuth: true,
  timeoutMs: false,
});
```

The timeout is enforced by the shared API middleware, so authentication failures and handler failures continue to use their existing response contracts.
