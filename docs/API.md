# ClipCash API — conventions

This document covers cross-cutting conventions shared by the ClipCash API
endpoints that the frontend consumes. Versioning rules live in
[`api-versioning.md`](./api-versioning.md); the machine-readable spec is
[`openapi.yaml`](./openapi.yaml).

## Pagination

All list endpoints use the same **cursor-based** pagination contract
(implementation: [`app/api/pagination.ts`](../app/api/pagination.ts)).

| Endpoint                        | Default sort         |
| ------------------------------- | -------------------- |
| `GET /api/jobs`                 | `createdAt` desc, `id` |
| `GET /api/clips`                | `createdAt` desc, `id` |
| `GET /api/wallet/transactions`  | `createdAt` desc, `id` |
| `GET /api/notifications`        | `createdAt` desc, `id` |

### Query parameters

| Name     | Type    | Default | Notes                                                                |
| -------- | ------- | ------- | -------------------------------------------------------------------- |
| `cursor` | string  | —       | Opaque cursor from `pagination.nextCursor`. Omit for the first page. |
| `limit`  | integer | `20`    | Page size. Clamped to `1…100`; non-numeric values fall back to `20`.  |

### Response body

```json
{
  "data": [{ "id": "clip_42", "createdAt": "2026-01-01T00:00:00.000Z" }],
  "pagination": {
    "nextCursor": "eyJ2IjoxNzY3MjI1NjAwMDAwLCJpZCI6ImNsaXBfNDIifQ",
    "hasMore": true,
    "total": 128
  }
}
```

- `nextCursor` — pass back as `?cursor=` to fetch the next page; `null` on the last page.
- `hasMore` — `true` while more items exist after this page.
- `total` — optional; only included when the count is cheap to compute.

### Cursor format

The cursor is **opaque** to clients: do not parse or construct it. Internally it
is a base64url-encoded JSON object holding the sort-field value and the ID of
the last item on the page (`{ "v": <sortValue>, "id": <id> }`). Keying on
`(sortValue, id)` keeps pages stable while new items are inserted and avoids
`OFFSET` scans on large tables.

### Errors

A malformed cursor returns `400 Bad Request`:

```json
{
  "error": "Invalid cursor",
  "message": "The `cursor` parameter is malformed or has expired.",
  "statusCode": 400
}
```

Clients should drop the cursor and restart from the first page.

### Example

```bash
# first page
curl "/api/clips?limit=20"
# next page
curl "/api/clips?limit=20&cursor=eyJ2IjoxNzY3MjI1NjAwMDAwLCJpZCI6ImNsaXBfNDIifQ"
```
