# Client limits and browser state behavior

## Uploads

The client rejects video files larger than **500 MB** before an upload request is made. The server remains authoritative and performs the same validation. The shared limit is `MAX_UPLOAD_SIZE_BYTES` in `app/lib/constants.ts`.

## Multiple sessions

Each browser tab has a session ID. Tabs exchange heartbeats and writes through `BroadcastChannel`, with the `storage` event as a fallback. When writes conflict, the newest timestamp wins; equal timestamps use the session ID as a deterministic tie-breaker. A warning is shown when another tab wins.

## Local storage

Persistence is best-effort. If storage is unavailable or full, the app continues with in-memory state. The data-layer cache is evicted and retried once before persistence is disabled for that write. Do not store secrets in the data-layer cache.
