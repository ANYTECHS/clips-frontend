# API Error Code Standard

Every API error should use the response envelope below:

```json
{
  "data": null,
  "error": "Human-readable message",
  "code": "INVALID_INPUT",
  "meta": { "timestamp": "2026-08-28T00:00:00.000Z" }
}
```

`code` is stable for client logic; `error` is intended for display and may change. New codes must be uppercase `SCREAMING_SNAKE_CASE`, describe a client-actionable condition, and be added to `app/api/types.ts` and `app/api/errorCodes.ts` with their HTTP status.

| Code | HTTP status | Meaning |
| --- | ---: | --- |
| `UNAUTHORIZED` | 401 | Authentication is missing or invalid |
| `SESSION_EXPIRED` | 401 | The session is no longer valid |
| `FORBIDDEN` | 403 | The caller lacks permission |
| `NOT_FOUND` | 404 | The requested resource does not exist |
| `JOB_NOT_FOUND` | 404 | The requested job does not exist |
| `JOB_FORBIDDEN` | 403 | The caller does not own the job |
| `INVALID_INPUT` | 400 | Request input is malformed or invalid |
| `VALIDATION_ERROR` | 400 | Structured schema validation failed |
| `MISSING_REQUIRED_FIELD` | 400 | A required request field is absent |
| `ALREADY_EXISTS` | 409 | The resource already exists |
| `CONFLICT` | 409 | The operation conflicts with current state |
| `FILE_TOO_LARGE` | 413 | The uploaded file exceeds the limit |
| `INVALID_FILE_TYPE` | 415 | The file type is unsupported |
| `VIRUS_DETECTED` | 422 | Security scanning rejected the file |
| `INSUFFICIENT_BALANCE` | 422 | The wallet balance is insufficient |
| `RATE_LIMITED` | 429 | Too many requests; honor `Retry-After` |
| `UPSTREAM_ERROR` | 502 | An upstream dependency failed |
| `INTERNAL_ERROR` | 500 | An unexpected server failure occurred |
| `SERVICE_UNAVAILABLE` | 503 | A dependency or service is unavailable |
| `STORAGE_ERROR` | 503 | Persistent storage is unavailable |
| `TIMEOUT` | 504 | The request exceeded its API deadline |
| `JOB_DISPATCH_FAILED` | 502 | Job submission to the processing backend failed |
| `MINT_FAILED` | 502 | Blockchain minting failed |
| `WALLET_NOT_FOUND` | 404 | The wallet does not exist |

Use `withApiMiddleware` or the factories in `app/api/apiResponse.ts` so status and code remain aligned. Legacy codes are accepted by `normalizeErrorCode` during migration but must not be introduced in new routes.
