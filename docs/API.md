# Next.js API routes

This document covers the routes served by this frontend under `app/api`. The
machine-readable contract lives in [`openapi.yaml`](./openapi.yaml); the two
must stay in sync.

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/proxy/*` | any | Forwards requests (with cookies) to the backend API |
| `/api/sse/*` | GET | Unbuffered server-sent-events proxy to the backend |
| `/api/download` | GET | Streams a Cloudinary/R2 file back as an attachment |
| `/api/youtube-info` | GET | Resolves YouTube metadata and a download URL |
| `/api/youtube-dl` | GET | Streams a YouTube CDN file through our origin |
| `/api/r2-proxy` | PUT | Fallback upload proxy to Cloudflare R2 |
| `/api/health/deep` | GET | App + backend dependency health check |

## Response helpers

Routes never call `NextResponse.json` directly. They use the helpers in
`app/api/apiResponse.ts`:

| Helper | Result |
| --- | --- |
| `success(data, status = 200)` | `data` as JSON |
| `error(message, status, code?)` | Standard error body (below) |
| `paginated(items, pagination)` | `{ items, pagination: { page, limit, total, totalPages } }` |
| `validationError(fields, message?)` | `400` + `VALIDATION_ERROR` with field errors in `details.fields` |
| `serverError(err, context?, message?)` | `500` + `INTERNAL_ERROR`, generic message, full error logged and sent to Sentry |
| `handleError(err, context?)` | `ApiError` → its own status/code/details; anything else → `serverError` |
| `empty(status = 204)` | Response without a body (e.g. `304 Not Modified`) |

Streaming routes (downloads, SSE, proxied backend bodies) still return raw
`Response` streams for their success path, but every error they produce goes
through the helpers.

This is enforced by an ESLint `no-restricted-syntax` rule on
`app/api/**/route.ts` and by `tests/api/noDirectNextResponseJson.test.ts`.

## Error format

Every error response has this JSON shape:

```json
{
  "error": "Bad Request",
  "message": "Missing url parameter.",
  "code": "VALIDATION_ERROR",
  "details": { "fields": { "url": "Missing url parameter." } }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `error` | string | HTTP reason phrase for the status (`Not Found`, `Bad Gateway`, …) |
| `message` | string | Human-readable description, safe to show to users |
| `code` | string, optional | Machine-readable code from `app/api/errorCodes.ts`. Clients should branch on this, not on `message` |
| `details` | object, optional | Extra structured data. Validation errors put field-level messages in `details.fields` |

Unhandled exceptions always return `500` with a generic `message`. Internal
error messages and stack traces are never sent to the client. They are logged
on the server and reported to Sentry.

### Error codes

| Code | Typical status | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_ERROR` | 400 | Field validation failed (see `details.fields`) |
| `AUTH_REQUIRED` | 401 | Authentication required or session invalid |
| `FORBIDDEN` | 403 | Not allowed (e.g. private video, disallowed upload host) |
| `ORIGIN_NOT_ALLOWED` | 403 | Cross-origin request from an origin outside `ALLOWED_ORIGINS` |
| `NOT_FOUND` | 404 | Resource missing or unavailable |
| `PAYLOAD_TOO_LARGE` | 413 | Content exceeds a size limit |
| `UNSUPPORTED_MEDIA_TYPE` | 400 / 415 | Content type is not accepted |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
| `UPSTREAM_ERROR` | 502 | Backend, CDN or storage failed |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable (e.g. backend cold start) |

`/api/proxy/*` passes the backend's own responses through unchanged. Only the
errors raised by the proxy itself (origin rejection, backend unreachable) use
the format above.
