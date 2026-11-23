# Webhooks

Clips sends outbound webhook events to HTTPS endpoints you register. Every
delivery is signed with **HMAC-SHA256** so you can verify it came from us and
was not tampered with.

There are two directions:

| Direction | Path | Auth |
|---|---|---|
| Inbound (platforms → Clips) | `POST /webhooks/earnings/:platform` | Platform signature (`x-tiktok-signature`, `x-hub-signature-256`, …) |
| Outbound (Clips → you) | `POST <your-url>` | `X-Clips-Signature` (this document) |

---

## Outbound webhook subscriptions

Register an endpoint (JWT required):

```http
POST /webhooks/subscriptions
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "url": "https://example.com/hooks/clips",
  "events": ["earning.created"],
  "label": "optional"
}
```

Response (the `secret` is returned **once** — store it securely):

```json
{
  "id": "sub_123",
  "url": "https://example.com/hooks/clips",
  "events": ["earning.created"],
  "secret": "whsec_<48 hex chars>",
  "isActive": true,
  "createdAt": "2026-11-22T00:00:00.000Z"
}
```

- `events` accepts `"earning.created"` or `"*"` (all events).
- `GET /webhooks/subscriptions` lists subscriptions — secrets are never
  returned again.
- `DELETE /webhooks/subscriptions/:id` removes one.

## Delivery format

Each delivery is a `POST` with `Content-Type: application/json`:

```http
POST https://example.com/hooks/clips
X-Clips-Event: earning.created
X-Clips-Delivery: evt_1732185600000_abc123
X-Clips-Timestamp: 2026-11-22T00:00:00.000Z
X-Clips-Signature: sha256=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

Body:

```json
{
  "id": "evt_1732185600000_abc123",
  "event": "earning.created",
  "createdAt": "2026-11-22T00:00:00.000Z",
  "data": {
    "id": 42,
    "clipId": 7,
    "amount": 1.5,
    "currency": "USD",
    "date": "2026-11-22T00:00:00.000Z",
    "source": "youtube_webhook",
    "platform": "youtube"
  }
}
```

Deliveries are best-effort with a 10 s timeout; non-2xx responses are logged
and not retried. `X-Clips-Delivery` is a unique id per delivery — use it for
deduplication.

## Signature verification algorithm

1. Take the **raw request body bytes exactly as received** — do not parse and
   re-serialize the JSON, or the signature will not match.
2. Compute `HMAC-SHA256(rawBody, subscriptionSecret)`.
3. Hex-encode the digest and prefix it with `sha256=`.
4. Compare the result to the `X-Clips-Signature` header using a
   **constant-time** comparison.
5. (Recommended) Reject deliveries whose `X-Clips-Timestamp` is older than
   ~5 minutes to blunt replay attacks.

### Node.js / Express example

```js
const crypto = require('crypto');

// IMPORTANT: mount express.raw() BEFORE express.json() for this route so
// req.body is the untouched Buffer.
app.post(
  '/hooks/clips',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const secret = process.env.CLIPS_WEBHOOK_SECRET; // whsec_... from creation
    const signature = req.headers['x-clips-signature'];

    const expected =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(req.body).digest('hex');

    const a = Buffer.from(String(signature ?? ''));
    const b = Buffer.from(expected);
    const valid =
      a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) return res.status(401).send('invalid signature');

    const event = JSON.parse(req.body.toString('utf8'));
    console.log('clips event:', event.event, event.data);
    res.status(200).send('ok');
  },
);
```

### Python (Flask) example

```python
import hashlib
import hmac

@app.route('/hooks/clips', methods=['POST'])
def clips_webhook():
    secret = os.environ['CLIPS_WEBHOOK_SECRET'].encode()
    body = request.get_data()  # raw bytes — do not use request.json first
    expected = 'sha256=' + hmac.new(secret, body, hashlib.sha256).hexdigest()
    signature = request.headers.get('X-Clips-Signature', '')
    if not hmac.compare_digest(expected, signature):
        return 'invalid signature', 401
    event = request.get_json()
    # handle event['event'] / event['data']
    return 'ok'
```

## Rotating a secret

There is no rotation endpoint yet — delete the subscription and create a new
one to receive a fresh secret.
