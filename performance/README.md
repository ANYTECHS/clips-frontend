# Performance — concurrent upload load test

Script: [`load-test-upload.k6.js`](load-test-upload.k6.js)

Targets the upload entry point used by the app (see the README's video upload
flow): `POST /api/proxy/videos` — a multipart upload through the frontend
proxy.

## Running

Install [k6](https://k6.io) and run:

```bash
k6 run performance/load-test-upload.k6.js \
  -e BASE_URL=http://localhost:3000 -e VUS=10 -e DURATION=30s
```

Options (all optional):

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Frontend origin |
| `ENDPOINT` | `/api/proxy/videos` | Upload endpoint path |
| `VUS` | `10` | Number of virtual users |
| `DURATION` | `30s` | Test duration |
| `FILE_SIZE` | `1048576` (1 MB) | Multipart file size in bytes |
| `AUTHORIZATION` / `COOKIES` | — | Auth headers, e.g. the session cookies of a logged-in user |

Note: the upload endpoint requires an authenticated session (JWT cookies set
by the backend). Without credentials, requests return `401 Unauthorized`.

## Measured results (local dev, no auth)

Measured on 2026-11-20 against `http://localhost:3000` with the dev server
running: 8 concurrent uploads of a 200 KB file, 40 requests total, no
credentials.

- **Throughput:** ~2.7 req/s (40 requests in ~14.9 s)
- **Error rate:** 100% — 9× `401 Unauthorized` (unauthenticated) and
  31× `429 Too Many Requests` (the ClipCash backend rate-limits under
  concurrency — 6 of 8 concurrent unauthenticated `POST /videos` requests
  return 429 even when hitting the backend directly).

With valid session credentials the expected behavior is non-error responses;
pass `AUTHORIZATION`/`COOKIES` to the script when you want to include them.
