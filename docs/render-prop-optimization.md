# Render prop optimization

## The problem

Render props (a prop whose value is a function returning JSX — e.g.
`errorFallback={(error) => <ErrorCard error={error} />}`) are almost always
passed as an inline arrow function. That function gets a new identity on
every render of the parent, and calling it directly inside the receiving
component produces a brand-new React element every time too — even when the
inputs the render prop actually depends on (an `error` object, a `retry`
callback) haven't changed. That defeats `React.memo`/`shouldComponentUpdate`
anywhere downstream, since a "different" element reference looks like new
content to React.

## Where it showed up

- `components/common/AsyncBoundary.tsx` — the `errorFallback` prop was
  invoked as `errorFallback(error, onRetry)` inline in `render()`, and the
  component itself wasn't memoized.
- `components/DataErrorBoundary.tsx` — a function `fallback` prop is called
  as `fallback({ error, resetErrorBoundary })` inline in `render()`.

Neither is on a hot path by itself, but both wrap arbitrary subtrees, so an
unmemoized render prop here can cascade into unrelated re-renders of whatever
it returns.

## The fix

`app/lib/renderProp.ts` provides two small caches that memoize a render
prop's *result*, not just the function reference:

- **`useRenderPropResult(renderProp, args)`** — for function components.
  Caches the last `(fn, args)` pair and only re-invokes `renderProp` when the
  function identity or any arg changes (shallow `Object.is` per element).
  Used in `AsyncBoundary`, which is also wrapped in `React.memo`.

  ```tsx
  const fallbackNode = useRenderPropResult(errorFallback, [error, onRetry] as const);
  // ...
  if (errorFallback) return <>{fallbackNode}</>;
  ```

- **`RenderPropCache`** — the class-component equivalent, for render props
  whose call signature doesn't map to a plain arg list (e.g. a single options
  object). Keep one instance per component instance (a class field) and pass
  the values the output actually depends on as the cache key, plus a thunk
  that performs the real call:

  ```tsx
  private fallbackCache = new RenderPropCache<[Fallback, Error, () => void], React.ReactNode>();

  // in render():
  this.fallbackCache.get(
    [fallback, this.state.error, this.resetErrorBoundary],
    () => fallback({ error: this.state.error!, resetErrorBoundary: this.resetErrorBoundary }),
  );
  ```

Both caches hold exactly one entry (the most recent call) — they're meant to
skip redundant re-invocation on adjacent re-renders, not to memoize an
unbounded history of past inputs.

## When to reach for this

Use one of these caches when a component:

1. Accepts a function prop that returns renderable output, **and**
2. Calls that function directly during render, **and**
3. Wraps or returns a non-trivial subtree that would benefit from bailing out
   via `React.memo` when nothing meaningful changed.

If the render prop is cheap and returns simple markup, the memoization
overhead isn't worth it — plain inline invocation is fine. Reach for these
helpers specifically when the render prop's output feeds into a subtree that
is otherwise memoized, since a fresh element reference silently defeats that
memoization.
