"use client";

import { useRef } from "react";

/**
 * Invokes a render-prop function and caches the resulting node so the same
 * reference is returned across re-renders when `args` are shallow-equal to
 * the previous call's. Render props (e.g. `errorFallback={(err) => <X/>}`)
 * are usually passed as a fresh inline function on every parent render, so
 * calling them directly on every render defeats `React.memo` on whatever
 * they return — this keeps the produced element stable so memoized subtrees
 * can actually bail out.
 *
 * Pass `undefined` for `renderProp` to clear the cache and get `undefined`
 * back (mirrors an optional render prop that isn't supplied).
 */
export function useRenderPropResult<TArgs extends readonly unknown[], TResult>(
  renderProp: ((...args: TArgs) => TResult) | undefined,
  args: TArgs,
): TResult | undefined {
  const cacheRef = useRef<{ fn: (...args: TArgs) => TResult; args: readonly unknown[]; result: TResult } | null>(
    null,
  );

  if (!renderProp) {
    cacheRef.current = null;
    return undefined;
  }

  const cached = cacheRef.current;
  const isStale =
    !cached ||
    cached.fn !== renderProp ||
    cached.args.length !== args.length ||
    cached.args.some((arg, i) => arg !== args[i]);

  if (isStale) {
    cacheRef.current = { fn: renderProp, args, result: renderProp(...args) };
  }

  return cacheRef.current!.result;
}

/**
 * Class-component equivalent of `useRenderPropResult`, for render props whose
 * call signature doesn't fit a plain arg list (e.g. a single options object).
 * Instantiate one per component instance (as a class field) and call `get`
 * from `render()`, passing the values the render prop's output depends on as
 * `key` and a thunk that actually invokes it as `compute`.
 */
export class RenderPropCache<TKey extends readonly unknown[], TResult> {
  private cached: { key: TKey; result: TResult } | null = null;

  get(key: TKey, compute: () => TResult): TResult {
    const cached = this.cached;
    const isStale =
      !cached || cached.key.length !== key.length || cached.key.some((k, i) => k !== key[i]);

    if (isStale) {
      this.cached = { key, result: compute() };
    }

    return this.cached!.result;
  }
}
