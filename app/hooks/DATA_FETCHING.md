# Data fetching pattern

The app uses one unified strategy for reads and writes: a shared
stale-while-revalidate cache (`app/lib/cache/RequestCache.ts`) accessed
through `useApiQuery` / `useApiMutation`.

**Why not React Query or SWR?** Both were considered. `RequestCache` already
covers what this app needs — dedup, TTL + stale-while-revalidate, tag-based
invalidation, LRU eviction — in a few KB with no new dependency (see the
rationale in `RequestCache.ts`, issue #873). `useApiQuery`/`useApiMutation`
give that cache a consistent, library-style interface so call sites don't
each reinvent loading/error state.

## Reads: `useApiQuery`

```ts
import { useApiQuery, cacheKey } from "@/app/hooks/useApiQuery";

const { data, loading, validating, error, refresh, invalidate } = useApiQuery<Project[]>(
  cacheKey("/api/projects", { page }),
  `/api/projects?page=${page}`,
  { tags: ["projects"], retry: 2 },
);
```

- `key` is the cache key (use `cacheKey(path, params)` to build one consistently).
- `url` is fetched with `apiFetch`, which throws a normalized `ApiError` on any
  non-2xx response — no more checking `res.ok` at every call site.
- `loading` is only true when there's nothing to show yet; a stale value
  renders immediately while `validating` refreshes it in the background.
- `retry` / `retryDelayMs` / `retryOptions` add automatic retries with exponential backoff.
- Pass `key: null` (or `url: null`) to skip fetching, e.g. while a required id
  is still unknown.

### Retry strategy & exponential backoff

Data fetching uses a centralized retry mechanism (`app/lib/retry.ts`) configured via `retryOptions` or `retry` / `retryDelayMs`:

- **Transient failures retried automatically**: Network failures (status 0), rate limits (HTTP 429), and server errors (HTTP 500, 502, 503, 504) are retried automatically.
- **Non-retryable errors fail fast**: Client errors (HTTP 400, 401, 403, 404, 405, 409, 422) and explicit `AbortError` / unmount operations fail fast on the initial attempt without unnecessary retries.
- **Exponential backoff**: Backoff delay increases exponentially between attempts: `delay = min(baseDelayMs * (backoffFactor ^ attempt), maxDelayMs)`. Default configuration uses `baseDelayMs: 500`, `maxRetries: 3`, `maxDelayMs: 10000`, `backoffFactor: 2`.
- **Cancellation & memory safety**: All retries respect `AbortSignal`. If a component unmounts or a request is cancelled while waiting in backoff sleep, the pending timer is cleared immediately, cancelling the operation without updating unmounted component state or creating memory leaks.

Requests started by `useCachedFetch` and `useApiQuery` receive an `AbortSignal`
and are cancelled when the hook unmounts or its key changes. Custom fetchers
should accept the optional signal and pass it to `fetch`:

```ts
useCachedFetch(key, (signal) => fetch(url, { signal }).then((response) => response.json()));
```

Treat `AbortError` as expected cancellation rather than displaying it as a
request failure. Retry delays are cancelled by the same signal.

### Priority strategy

Cache misses are scheduled through a bounded queue with three priority levels:
`high` is for data required to render the current view, `normal` is for the
usual page data, and `low` is for secondary widgets or opportunistic work.
Requests at the same level run in FIFO order. Fresh cache hits and requests
already in flight are not delayed or duplicated.

Set priority on a query when the default is not appropriate:

```ts
useApiQuery(key, url, { priority: "high" });
useApiQuery(secondaryKey, secondaryUrl, { priority: "low" });
```

The authenticated dashboard warms `/api/user` when its shell mounts because
the profile is needed by both the header and plan-usage panel. Use
`warmCriticalData` for similarly small, shared datasets that are needed
immediately; keep speculative or below-fold data on demand or idle-prefetched.
Warmers should accept an `AbortSignal`, use the shared `RequestCache`, and
assign `high` priority so they deduplicate with the eventual consumer.

## Batching independent reads

When an endpoint accepts multiple identifiers, use `RequestCache.fetchBatch` at
the data boundary instead of starting one request per identifier. The cache
skips fresh entries, shares keys already in flight, stores each returned value
under its own key, and validates that the loader returned exactly the requested
set.

```ts
const values = await requestCache.fetchBatch(
  clipIds.map((id) => cacheKey("/api/clips", { id })),
  (keys) => apiFetch("/api/clips/batch", {
    method: "POST",
    body: JSON.stringify({ keys }),
  }),
  { tags: ["clips"] },
);
```

Batch loaders must return a `Map` with one value for every unique, non-empty
key. Keep the batch size bounded by the receiving API's limits, and preserve
the caller's order when rendering by mapping the original key list over the
returned map. Measure batching with the loader call count and request latency;
the expected improvement is one network request per batch rather than one per
item.

## Writes: `useApiMutation`

```ts
import { useApiMutation } from "@/app/hooks/useApiMutation";
import { apiFetch } from "@/app/lib/apiError";

const { mutate, mutateAsync, loading, error } = useApiMutation(
  (title: string) => apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ title }) }),
  { invalidateTags: ["projects"] },
);
```

`invalidateTags` drops every cached query sharing that tag, so the next read
refetches instead of serving stale data after a write.

## Error handling

Both hooks surface failures as a plain `Error` (or `ApiError`, which adds
`status`/`info`) via their `error` field — never a thrown exception across a
render. Pair with `AsyncBoundary` (`components/common/AsyncBoundary.tsx`) for
a consistent loading/error/content UI:

```tsx
<AsyncBoundary loading={loading} error={error} onRetry={refresh} skeleton={<CardGridSkeleton />}>
  <Content data={data} />
</AsyncBoundary>
```

## Viewport-based fetching

For below-fold widgets, `useViewportFetch` (`app/hooks/useViewportFetch.ts`)
only fires the request once the target element nears the viewport:

```ts
const { ref, data, loading } = useViewportFetch<Stats, HTMLDivElement>(
  "/api/stats/secondary",
  () => apiFetch("/api/stats/secondary"),
);
```

## Existing hooks that predate this pattern

`useDashboardData` (Zustand store) and a few polling hooks
(`useTransformStatus`, `useProcessingStatus`) have their own caching/polling
needs and are left as-is — this pattern is for new and migrated call sites,
not a mandate to rewrite hooks that already work.

## Offline, dedup, and invalidation

The data layer in `app/lib/data-layer` sits next to `RequestCache`:

- **Offline (#910).** `navigator.onLine` plus `online`/`offline` events. GETs
  serve cached JSON while disconnected. Mutations that opt in are queued to
  localStorage and replayed by `DataSyncProvider` on reconnect. Auth and mint
  paths are never queued.
- **Dedup (#913).** Identical in-flight GETs share one network call. Optional
  `dedupeWindowMs` reuses a settled result. Metrics: `getDedupMetrics()` and
  `requestCache.stats().deduplicationRate`.
- **Invalidation (#911).** Successful mutations drop matching tags/keys/prefixes
  in both the data-layer cache and `RequestCache`. `invalidateStale()` is
  time-based eviction. `invalidateKey` / `invalidateAll` are the manual APIs.
  Zustand dashboard/earnings TTLs subscribe so the UI refetches after a write.

