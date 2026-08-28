# app/api

Next.js App Router API routes. Auth column values:
- **Session** — requires a signed-in NextAuth session (`auth()` / `getServerSession`); returns 401 if missing.
- **Job owner** — session required, and the session's user must own the job (`requireJobOwner`); 401/403/404.
- **Shared secret** — Bearer token compared against a server-only env secret (not a user session).
- **Shared-secret token (email link)** — a random session/approval token from an emailed link acts as the credential; no login required.
- **None** — publicly accessible (may still be IP rate-limited).

| Route | Methods | Auth | Notes |
|---|---|---|---|
| `health` | GET | None | Liveness probe — confirms process is alive. Always 200. |
| `health/ready` | GET | None | Readiness probe — checks Redis, AI backend, and S3. 200/503. |
| `docs` | GET | None | Interactive Swagger UI (Swagger UI 5 via CDN). |
| `docs/openapi.json` | GET | None | OpenAPI 3.1 spec as JSON. |
| `auth/[...nextauth]` | GET/POST | None (NextAuth's own flow) | OAuth sign-in/callback handlers. |
| `auth/passkey/register` | GET, POST | Session | WebAuthn passkey registration options + verification. |
| `auth/passkey/authenticate` | GET, POST | Session | WebAuthn passkey authentication options + verification. |
| `csp-report` | POST | None (rate-limited) | Browser CSP violation reports (`report-uri`); logs to structured logger. |
| `dashboard` | GET | Session | Dashboard summary stats/revenue/recent projects. |
| `earnings` | GET | Session | Earnings totals/breakdown. |
| `earnings/transactions` | GET | Session | Paginated earnings transaction list. |
| `jobs/[id]` | GET, POST | Job owner | GET reads job status; POST restarts a job (CSRF-checked, rate-limited). |
| `jobs/[id]/stream` | GET | Job owner | Server-Sent Events stream of live job progress. |
| `jobs/[id]/callback` | POST | Shared secret (`AI_BACKEND_CALLBACK_SECRET`) | Sole writer of job status; called by the AI backend, not the browser. See replay-protection notes in the route file. |
| `jobs/metrics` | GET | Session | Aggregate job metrics for the signed-in user. |
| `prices/xlm` | GET | None | Cached XLM/USD price (CoinGecko), with fallback on rate-limit. |
| `prices/assets` | GET | None | Cached USD prices for a set of asset codes (CoinGecko). |
| `recovery/initiate` | POST | None (rate-limited: 5/10min/IP) | Starts a social-recovery session and emails guardians. |
| `recovery/approve` | POST | Shared-secret token (email link) (rate-limited: 20/min/IP) | Records a guardian's approval. |
| `recovery/check` | GET | Shared-secret token (`sessionId`) (rate-limited: 30/min/IP) | Polls recovery status; returns reconstructed backup once threshold is met. |
| `sponsorship` | GET | None | Fee-sponsorship availability/estimate for a public key. |
| `transform` | POST | Session | Starts a single-clip style transform job. |
| `transform/batch` | POST | Session | Starts a batch style transform job across multiple clips. |
| `transform/styles` | GET | None | Static catalogue of available transform styles. |
| `upload` | POST | Session | Video upload endpoint (feeds the transform pipeline). |
| `user/onboarding` | POST | Session | Persists onboarding responses for the signed-in user. |
| `user/passkey` | GET, POST | Session | Lists / registers passkey credentials for the signed-in user. |
| `user/profile` | GET, PATCH | Session | Reads/updates the signed-in user's profile. |
| `wallet/history` | GET | None | Public Horizon-derived balance history for a given public key. |

## Shared helpers (`app/api/jobs/shared/`, `app/api/lib/`)
- `authGuard.ts` — `requireAuth()` / `requireJobOwner(jobId)` session + ownership checks used by the job routes.
- `jsonBody.ts` — `parseJsonRequest()` validates `Content-Type` and safely parses the JSON body.
- `jobStore.ts` / `jobRepository.ts` — Redis-backed (falls back to in-memory) job persistence.
- `feeSponsorship.ts` — sponsor balance/fee estimation logic used by `sponsorship/route.ts`.

## API infrastructure (`app/api/`)
- `types.ts` — `ApiResponse<T>` envelope, `ErrorCode` union, `PaginationMeta`, `ResponseMeta`, and builder utilities (`ok`, `err`, `paginationMeta`). (Issue #891)
- `apiResponse.ts` — `NextResponse` factory functions: `success`, `created`, `paginated`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `rateLimited`, `internalError`, `serviceUnavailable`, `timeout`. (Issue #891)
- `requestLogger.ts` — `withRequestLogging(handler)` HOF and imperative `logRequest(req)` for structured request/response logging with sensitive-data redaction and `X-Request-ID` propagation. (Issue #894)
- `withApiMiddleware` — shared auth, error, and timeout handling. Standard routes time out after 10 seconds (configurable with `API_TIMEOUT_MS`); streaming routes must opt out with `timeoutMs: false`. Timeout responses are `504` with code `TIMEOUT`. See [`docs/API_TIMEOUT_POLICY.md`](../../docs/API_TIMEOUT_POLICY.md).
- `health/healthCheck.ts` — `livenessCheck()` and `readinessCheck()` with concurrent dependency probes (Redis, AI backend, S3). (Issue #898)
- `docs/openapi.ts` — OpenAPI 3.1 specification object (TypeScript const). (Issue #896)

## Response transformation standard

All JSON API responses use the following envelope:

```ts
{ data: T | null, error: string | null, code?: ErrorCode, meta?: ResponseMeta }
```

Successful responses put the resource or result in `data` and set `error` to
`null`. Errors set `data` to `null`, provide a human-readable `error`, and use
the `code` field for machine-readable handling. `meta` contains the response
timestamp and, when available, pagination or the inbound `X-Request-ID`.

Use the factories in `app/api/apiResponse.ts` (`success`, `created`,
`paginated`, and the error helpers) when creating a route response. Routes
wrapped with `withApiMiddleware` in `app/lib/apiMiddleware.ts` are transformed
at the boundary as a compatibility measure: raw JSON success and error objects
are normalized automatically, and existing envelopes are preserved.

Transformation only applies to JSON responses. `204 No Content`, text, file,
and streaming responses pass through unchanged. Do not put secrets or internal
exception details in response data; use an `ApiError` when a controlled error
status and code are needed.
