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
- `retry` / `retryDelayMs` add automatic retries with exponential backoff.
- Pass `key: null` (or `url: null`) to skip fetching, e.g. while a required id
  is still unknown.

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
