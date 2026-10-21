# Asset Delivery, Bundle Size, Virtual Scrolling & Service Worker

Covers issues #1176, #1177, #1178 and #1179.

## Asset delivery (#1176)

| Concern | Where |
|---|---|
| Compression | `compress: true` in `next.config.ts` (gzip from `next start`; CDN/edge adds brotli) |
| Minification | SWC minifier (always on in Next 15+); `removeConsole` in production |
| Images | `next/image` with AVIF/WebP, `minimumCacheTTL: 86400` |
| Versioning | `generateBuildId` uses `VERCEL_GIT_COMMIT_SHA` / `GIT_COMMIT_SHA`; `/_next/static` is content-hashed and served `immutable` |
| CDN | Set `NEXT_PUBLIC_CDN_URL` → used as `assetPrefix` and allowed in CSP / image hosts |
| Source maps | `productionBrowserSourceMaps: false`; Sentry uploads privately |

**Measuring:** run Lighthouse CI (`@lhci/cli`) before/after and compare
`transfer size` and LCP; check `content-encoding` and `cache-control`
response headers with `curl -sI -H 'Accept-Encoding: gzip' <url>/_next/static/...`.

## Bundle size (#1178)

- Analyze: `npm run analyze` (`@next/bundle-analyzer`, `ANALYZE=true`).
- Budgets: `bundle-budget.json`, enforced by `scripts/check-bundle-size.js`
  after every `npm run build` (`npm run bundle:report` for a breakdown).
- Tree-shaking: `experimental.optimizePackageImports` rewrites barrel imports
  for `lucide-react`, `@stellar/stellar-sdk`, `zod`, `dompurify`, `zustand`,
  `@simplewebauthn/browser`; webpack `usedExports`/`sideEffects` are enabled.
- Heavy libraries: `@tanstack/react-virtual` was replaced with the
  dependency-free `useSimpleVirtualizer`. Prefer `next/dynamic` for large,
  below-the-fold components.

## Virtual scrolling (#1177)

`components/common/VirtualList.tsx` (named export `VirtualList`) renders only
rows near the viewport via `app/hooks/useSimpleVirtualizer.ts`. Pass
`scrollRestorationKey` to save/restore the window scroll position across
navigations:

```tsx
<VirtualList
  items={transactions}
  itemKey={(t) => t.id}
  rowHeight={84}
  gap={8}
  scrollRestorationKey="activity-feed"
  renderItem={(t) => <TransactionRow transaction={t} />}
/>
```

Try it with large datasets in Storybook (`Common/VirtualList`). See also
`docs/list-virtualization.md`. Measure with React Profiler: commit time and
DOM node count should stay flat as the item count grows.

## Service worker / PWA (#1179)

`public/sw.js`, registered in production by
`app/components/ServiceWorkerRegistrar.tsx` (mounted in the root layout).

- **Static assets:** cache-first (`static-v1`), pre-caches `/`, `/offline.html`.
- **API:** network-first / cache-first / stale-while-revalidate by endpoint.
- **Offline fallback:** navigations that fail serve `public/offline.html`.
- **Background sync:** failed same-origin `/api/*` writes are queued in the
  `sync-queue-v1` cache and answered with `202 { queued: true }`. They replay
  on the `replay-api-requests` sync event, or when the page fires `online`
  (fallback for browsers without Background Sync).
- **Updating:** bump the cache names and add the old ones to `CACHES_TO_CLEAN`.

**Testing:** `npm run build && npm start`, then in DevTools → Application →
Service Workers check it's activated; tick *Offline* and reload to see the
fallback page; submit a form offline, untick *Offline* and confirm the
request replays (Network tab) and the `sync-queue-v1` cache empties.
