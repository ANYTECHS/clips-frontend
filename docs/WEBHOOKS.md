# Webhooks API

Subscribe an HTTPS endpoint to receive real-time notifications when events
happen in your account, instead of polling the API.

## Event types

| Event               | Fired when...                                    |
| ------------------- | ------------------------------------------------- |
| `job.completed`     | An AI processing job finishes successfully.        |
| `transform.completed` | A clip transform finishes successfully.          |
| `clip.minted`       | A clip is minted as an NFT.                        |
| `earnings.received` | A new earnings transaction is recorded.            |

Defined in [`app/lib/webhooks/types.ts`](../app/lib/webhooks/types.ts) as
`WEBHOOK_EVENT_TYPES`.

## Managing webhook endpoints

All endpoints require an authenticated session and are scoped to the
calling user.

### Register a webhook

```
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://example.com/webhooks/clips",
  "events": ["job.completed", "clip.minted"]
}
```

Response (`201`):

```json
{
  "data": {
    "id": "wh_...",
    "url": "https://example.com/webhooks/clips",
    "events": ["job.completed", "clip.minted"],
    "secret": "whsec_...",
    "active": true,
    "createdAt": "2026-08-30T00:00:00.000Z"
  },
  "error": null
}
```

**The `secret` is only returned once, at creation.** Store it — it's needed
to verify deliveries (see below). It cannot be retrieved again; delete and
recreate the webhook to rotate it.

### List your webhooks

```
GET /api/webhooks
```

Returned endpoints never include the `secret` field.

### Update or disable a webhook

```
PATCH /api/webhooks/{id}
Content-Type: application/json

{ "active": false }
```

Accepts any of `url`, `events`, `active`.

### Delete a webhook

```
DELETE /api/webhooks/{id}
```

## Authenticating deliveries

Every delivery is signed with HMAC-SHA256 over `${timestamp}.${rawBody}`,
using the endpoint's `secret`. Three headers are sent with each request:

- `X-Webhook-Id` — the event id (`evt_...`), useful for idempotency.
- `X-Webhook-Event` — the event type, e.g. `job.completed`.
- `X-Webhook-Timestamp` — Unix seconds the request was signed.
- `X-Webhook-Signature` — hex-encoded HMAC-SHA256 signature.

Verify a delivery like this (Node example — see
[`app/lib/webhooks/signing.ts`](../app/lib/webhooks/signing.ts) for the
reference implementation):

```ts
import crypto from "crypto";

function isValid(secret: string, rawBody: string, timestamp: string, signature: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
```

Reject requests where `X-Webhook-Timestamp` is more than a few minutes old
to prevent replay of a captured request.

## Delivery payload

```json
{
  "id": "evt_...",
  "type": "job.completed",
  "createdAt": "2026-08-30T00:00:00.000Z",
  "data": { "jobId": "...", "momentsFound": 4 }
}
```

## Retry behavior

A non-2xx response or network error is retried up to 5 attempts total, with
increasing delay between attempts: 5s, 30s, 2min, 10min. After the final
attempt the delivery is marked `failed` and no further retries occur —
disable and re-enable the endpoint (or re-trigger from the source event) to
try again. Respond `2xx` as soon as the event is durably queued on your
side; do the actual processing asynchronously so slow work on your end
doesn't cause spurious retries.

Delivery is fire-and-forget from the API's perspective — registering or
triggering a webhook never blocks on the receiving endpoint's latency.
