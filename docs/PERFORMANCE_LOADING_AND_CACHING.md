# Loading, Splitting & Caching Strategy

Covers issues #1172, #1173, #1174 and #1175.

## Image lazy loading (#1172)
- `next/image` lazy-loads by default. For long below-fold grids use `components/common/LazyImage`, which defers mounting via `IntersectionObserver` (200px root margin) and shows a pulse/blur placeholder until loaded, with an error fallback.
- Raw `<img>` elements (blob/data previews that cannot go through the optimizer) must set `loading="lazy"` and `decoding="async"`.
- Only above-the-fold hero/LCP images should use `priority`.
- Measure: compare "Transferred" bytes and LCP in Lighthouse / DevTools Network before and after scrolling.

## Code splitting (#1173)
- Route-based splitting is automatic with the App Router (one chunk per segment).
- Heavy, interaction-only widgets load with `next/dynamic` (`ssr: false` + skeleton), e.g. `SocialRecoveryConfig` and `TrustlineManager` (Stellar SDK) in settings.
- `next.config.ts` splits vendors into `framework`, per-package `lib.*` and `commons` chunks, capped at ~244 KB (`maxSize`) with up to 25 initial requests so large vendors cache independently.
- Measure: `ANALYZE=true npm run build` and compare against `bundle-budget.json`.

## Database queries (#1174)
- Slow queries (> `DATABASE_SLOW_QUERY_THRESHOLD`, default 1000ms) are logged by `app/lib/prismaMiddleware.ts`; set `DATABASE_LOG_POOL_METRICS=true` to log every query with duration.
- Added composite indexes: `ApiUsage(apiKeyId, createdAt)` and `EarningsReportDelivery(status, createdAt)` (migration `20261021000002_add_query_perf_indexes`).
- Query structure: select only needed fields (`select`), paginate with cursors, filter on indexed leading columns, avoid N+1 by using `include`/`in` lookups.
- Caching: wrap hot reads in `cachedQuery(key, ttlMs, fn)` from `app/lib/queryCache.ts`; call `invalidateQuery(prefix)` after writes. `getQueryCacheStats()` reports hits, misses and hit rate.

## Response caching (#1175)
- `cachedJson(request, body, opts)` in `app/lib/responseCache.ts` sets `Cache-Control` (browser), `CDN-Cache-Control` (edge `s-maxage`) and a content ETag, returning `304` on `If-None-Match` matches. Used by `GET /api/prices/xlm`.
- Invalidation: ETags are content-derived, so changed data yields a new ETag; short `s-maxage` + `stale-while-revalidate` bounds staleness. Static assets use immutable caching (see `app/lib/cacheHeaders.ts` and `next.config.ts` headers).
- Only public, non-user-specific data may use `cachedJson`; authenticated routes stay `private, no-store`.
- Measure: `getResponseCacheStats()` exposes the 304 hit rate; CDN hit rate is visible in the CDN dashboard (`cf-cache-status` / `x-cache` headers).
