# ClipCash API Documentation

## Overview

The ClipCash API provides programmatic access to ClipCash functionality for custom integrations. All API requests require authentication using an API key.

## Authentication

All API requests must include an `Authorization` header with a Bearer token:

```
Authorization: Bearer ck_your_api_key_here
```

### API Key Management

Generate and manage API keys through the Settings page in the ClipCash dashboard.

## Base URL

```
https://clipcash.ai/api/v1
```

## Rate Limiting

API requests are rate-limited based on your plan:
- Free: 100 requests/hour
- Pro: 1,000 requests/hour
- Enterprise: Custom limits

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Endpoints

### Clips

#### List Clips

```http
GET /api/v1/clips
Authorization: Bearer ck_your_api_key_here
```

**Response:**
```json
{
  "data": [
    {
      "id": "clip_123",
      "title": "My Clip",
      "originalUrl": "https://example.com/video.mp4",
      "status": "completed",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "responseTime": 45
  }
}
```

**Required Scopes:** `clips:read`

#### Create Clip

```http
POST /api/v1/clips
Authorization: Bearer ck_your_api_key_here
Content-Type: application/json

{
  "title": "My New Clip",
  "originalUrl": "https://example.com/video.mp4"
}
```

**Response:**
```json
{
  "data": {
    "id": "clip_456",
    "title": "My New Clip",
    "originalUrl": "https://example.com/video.mp4",
    "status": "processing",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "responseTime": 120
  }
}
```

**Required Scopes:** `clips:write`

### Webhooks

#### List Webhooks

```http
GET /api/v1/webhooks
Authorization: Bearer ck_your_api_key_here
```

**Required Scopes:** `webhooks:read`

#### Create Webhook

```http
POST /api/v1/webhooks
Authorization: Bearer ck_your_api_key_here
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["clip.created", "clip.processed"],
  "secret": "your_webhook_secret"
}
```

**Required Scopes:** `webhooks:write`

### Analytics

#### Get Usage Statistics

```http
GET /api/v1/analytics/usage
Authorization: Bearer ck_your_api_key_here
```

**Required Scopes:** `analytics:read`

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

## Webhook Events

### Event Types

- `clip.created` - A new clip was created
- `clip.processed` - A clip finished processing
- `clip.published` - A clip was published
- `clip.minted` - A clip was minted as NFT
- `payment.received` - A payment was received
- `user.created` - A new user was created
- `subscription.updated` - A subscription was updated

### Webhook Payload

```json
{
  "eventType": "clip.processed",
  "data": {
    "clipId": "clip_123",
    "title": "My Clip",
    "status": "completed"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Webhook Signature

Webhook requests include a signature in the `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=abc123...
```

Verify the signature using your webhook secret:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## SDKs

### JavaScript/TypeScript

```bash
npm install @clipcash/sdk
```

```javascript
import { ClipCashClient } from '@clipcash/sdk';

const client = new ClipCashClient({
  apiKey: 'ck_your_api_key_here'
});

const clips = await client.clips.list();
```

### Python

```bash
pip install clipcash-sdk
```

```python
from clipcash import ClipCashClient

client = ClipCashClient(api_key='ck_your_api_key_here')
clips = client.clips.list()
```

## Support

For API support, contact: api-support@clipcash.ai