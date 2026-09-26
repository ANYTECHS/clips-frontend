# Data layer (offline cache, dedup, invalidation)

Coordinated client data path used by dashboard/earnings/user fetches and `ApiClient`.

```
GET:     Request → Deduplication → Cache → Network (stale cache fallback offline)
MUTATION: Online execute | Offline queue → Reconnect sync → Invalidation
```

## What this covers

- **#910 Offline handling** — `navigator.onLine` + `online`/`offline` events, GET cache (memory + optional localStorage), mutation queue, automatic replay on reconnect.
- **#913 Deduplication** — identical in-flight GETs share one network call; optional window reuses a settled result; metrics via `getDedupMetrics()`.
- **#911 Invalidation** — mutation-triggered tag/key/prefix invalidation, TTL/stale eviction (`invalidateStale`), and `invalidateKey` / `invalidateAll` for manual control. Zustand dashboard/earnings caches subscribe so UI refetches after invalidation.

## Usage

```ts
import { getJson, mutate, invalidateTag, startAutomaticSync } from "@/app/lib/data-layer";

const dashboard = await getJson({
  url: "/api/dashboard",
  tags: ["dashboard"],
  persist: true,
});

await mutate({
  method: "POST",
  url: "/clips/post",
  body: { clipIds },
  invalidateTags: ["clips", "dashboard"],
});
```

`DataSyncProvider` starts automatic sync and shows the offline / reconnect / sync banner.

## What is not queued or persisted

- Auth (`/auth`, `/api/auth`) — never cached or queued
- Wallet / mint / on-chain writes — `queueWhenOffline: false`
- Credentials (`credentials: "include"`) — not persisted to localStorage

## Config

Optional `NEXT_PUBLIC_DATA_*` variables are documented in `.env.example`.
