"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestCache } from "@/app/lib/cache/RequestCache";
import { ApiError } from "@/app/lib/apiError";

export interface UseApiMutationOptions<TResult, TArgs> {
  /** Cache tags to invalidate after a successful mutation (e.g. ["projects"]). */
  invalidateTags?: string[];
  onSuccess?: (result: TResult, args: TArgs) => void;
  onError?: (error: ApiError | Error, args: TArgs) => void;
}

export interface UseApiMutationResult<TResult, TArgs> {
  mutate: (args: TArgs) => void;
  mutateAsync: (args: TArgs) => Promise<TResult>;
  data: TResult | undefined;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Unified mutation hook — the write-side counterpart to `useApiQuery`.
 * Runs `mutationFn`, tracks loading/error state, and invalidates any cache
 * tags whose data the mutation just made stale.
 *
 * ```ts
 * const { mutate, loading } = useApiMutation(
 *   (title: string) => apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ title }) }),
 *   { invalidateTags: ["projects"] },
 * );
 * ```
 */
export function useApiMutation<TResult, TArgs = void>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: UseApiMutationOptions<TResult, TArgs> = {},
): UseApiMutationResult<TResult, TArgs> {
  const [data, setData] = useState<TResult | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutateAsync = useCallback(async (args: TArgs): Promise<TResult> => {
    setLoading(true);
    setError(null);

    try {
      const result = await mutationFnRef.current(args);
      if (mountedRef.current) setData(result);

      for (const tag of optionsRef.current.invalidateTags ?? []) {
        requestCache.invalidateTag(tag);
      }
      optionsRef.current.onSuccess?.(result, args);
      return result;
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) setError(normalized);
      optionsRef.current.onError?.(normalized, args);
      throw normalized;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const mutate = useCallback(
    (args: TArgs) => {
      void mutateAsync(args).catch(() => {
        // Errors are surfaced via `error`; swallow here so callers that
        // don't await `mutate` don't get an unhandled rejection.
      });
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, mutateAsync, data, loading, error, reset };
}
