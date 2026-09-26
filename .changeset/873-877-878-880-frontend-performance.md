---
"clipsproject": patch
---

Frontend performance work across bundle size, SSE lifecycle, route loading and API caching.

- Drop four unused dependencies (`canvas-confetti`, `qrcode`, `@testing-library/dom`, `@types/dompurify`) and their `@types` companion, add `optimizePackageImports` for the barrel-heavy packages, and stop the custom `splitChunks` config from disabling Next.js's own framework and library chunk groups. Bundle budgets now live in `bundle-budget.json` and are enforced in CI by `npm run bundle:check`.
- Add `ManagedEventSource`: SSE connections now reconnect with capped exponential backoff and jitter instead of the browser's uncapped native retry, give up cleanly into a fallback, and are tracked in a bounded pool so a leaked stream fails loudly. Adopted by the dashboard and Horizon balance streams, which previously had no error handling at all.
- Every dashboard route segment now has a `loading.tsx`, sidebar links prefetch on navigation intent rather than all at once on render, and the social-recovery panel is split out of the Settings bundle.
- Add `RequestCache` and `useCachedFetch`: stale-while-revalidate reads, in-flight deduplication, LRU size limits and tag-based invalidation, replacing the ad-hoc per-feature caches.
