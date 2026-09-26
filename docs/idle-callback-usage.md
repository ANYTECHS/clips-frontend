# Idle callback usage

Guidance for deferring non-critical work off the main thread with
`requestIdleCallback`.

## When to use it

Defer work that:

- Doesn't affect what's currently on screen (analytics, logging, cache
  warming, prefetching).
- Isn't needed to respond to the interaction that triggered it (a click
  handler that also fires a tracking event doesn't need the event sent
  before the click's own UI update paints).
- Can tolerate running a few hundred milliseconds late, or being skipped
  entirely on a very busy page (idle callbacks are not guaranteed to run
  before their `timeout` — treat `timeout` as a deadline, not a schedule).

Don't use it for anything the user is waiting on — form validation on
submit, navigation, or anything that gates visible state.

## Where it's implemented

- `app/lib/mainThreadOptimization.ts` — `scheduleWork(fn, priority)` is the
  shared entry point. `priority` is `"background"` (deferred, longest
  fallback delay), `"user-visible"` (deferred, short fallback delay), or
  `"critical"` (next tick, no idle wait). It also exports `monitorLongTasks`,
  `mainThreadBudget`, `debounce`, `throttle`, and `processInChunks` (chunked
  array processing that yields to idle time between chunks).
- `app/hooks/useMainThreadOptimization.ts` wraps the above for components
  that want `scheduleTask`/`processArray`/`debounce`/`throttle` plus
  optional long-task monitoring in development.
- `app/lib/renderPriorityQueue.ts` — a priority queue specifically for
  deferring the render of off-screen widgets (analytics cards, secondary
  lists, below-fold sections).
- `app/lib/analytics.ts` — `trackEvent`/`trackPageView` sanitize properties
  and dispatch to the configured provider (GA4/Plausible/custom fetch)
  inside `scheduleWork(..., "background")`, since neither step needs to
  complete before the interaction that fired them finishes rendering.
- `components/AnalyticsProvider.tsx`, `components/CryptoSaltInitializer.tsx`,
  and `app/lib/prefetch/usePrefetch.ts` call `window.requestIdleCallback`
  directly for one-off startup work (analytics init, crypto salt migration,
  route prefetching).

## Fallback

Every call site (and `scheduleWork` itself) checks
`"requestIdleCallback" in window` before using it and falls back to
`setTimeout` otherwise. This covers Safari (no `requestIdleCallback`
support as of this writing), SSR (`window` is undefined), and test
environments (jsdom doesn't implement it).

## Adding a new deferred task

```ts
import { scheduleWork } from "@/app/lib/mainThreadOptimization";

scheduleWork(() => {
  // non-critical work
}, "background");
```

Or, from a component, via the hook:

```ts
const { scheduleTask } = useMainThreadOptimization();
scheduleTask(() => warmCache(items), "background");
```
