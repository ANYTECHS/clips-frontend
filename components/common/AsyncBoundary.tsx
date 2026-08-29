"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useRenderPropResult } from "@/app/lib/renderProp";

export interface AsyncBoundaryProps {
  loading: boolean;
  error: Error | null | undefined;
  /** Rendered while `loading` is true. Defaults to a centered spinner. */
  skeleton?: React.ReactNode;
  /** Called when the user presses "Try again". Omit to hide the retry button. */
  onRetry?: () => void;
  children: React.ReactNode;
  /** Rendered instead of the default error card. */
  errorFallback?: (error: Error, retry?: () => void) => React.ReactNode;
}

/**
 * Consistent loading/error/content pattern for a single data-fetching call
 * site: shows `skeleton` while loading, a standardized error card (with
 * retry) if `error` is set, and `children` otherwise. Pairs with
 * `useApiQuery` / `useCachedFetch`, whose `loading` and `error` fields plug
 * straight in.
 *
 * ```tsx
 * const { data, loading, error, refresh } = useApiQuery(...);
 * return (
 *   <AsyncBoundary loading={loading} error={error} onRetry={refresh} skeleton={<CardSkeleton />}>
 *     <Content data={data} />
 *   </AsyncBoundary>
 * );
 * ```
 */
function AsyncBoundary({
  loading,
  error,
  skeleton,
  onRetry,
  children,
  errorFallback,
}: AsyncBoundaryProps) {
  // Called unconditionally (Rules of Hooks) even though the result is only
  // read below when `error` is set; the cast is safe since `errorFallback`
  // is never invoked with a null/undefined error in that case.
  const fallbackNode = useRenderPropResult(errorFallback, [error as Error, onRetry] as const);

  if (loading) {
    return (
      <>
        {skeleton ?? (
          <div className="flex justify-center py-16" role="status" aria-label="Loading">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </>
    );
  }

  if (error) {
    if (errorFallback) return <>{fallbackNode}</>;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center" role="alert">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Couldn&apos;t load this content</p>
          <p className="text-xs text-muted-foreground max-w-xs">{error.message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export default React.memo(AsyncBoundary);
