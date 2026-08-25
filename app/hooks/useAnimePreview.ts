"use client";

/**
 * useAnimePreview
 *
 * Fires a low-res preview request whenever the anime transform options change,
 * debounced so the backend is not hit on every slider tick. The preview
 * endpoint returns a frame URL within ~5 seconds for the UI to display.
 *
 * Usage:
 * ```tsx
 * const { previewUrl, isLoading, error } = useAnimePreview({
 *   clipId,
 *   options: animeOptions,
 *   enabled: selectedStyle === "anime",
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { AnimeTransformOptions } from "@/app/lib/animeTransform";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseAnimePreviewOptions {
  /** The source clip id to preview. Pass null/undefined to disable. */
  clipId: string | null | undefined;
  /** Current anime transform options. A change triggers a new preview. */
  options: AnimeTransformOptions;
  /** Set to false to suppress previews (e.g. while no clip is selected). */
  enabled?: boolean;
  /**
   * Debounce delay in ms. Preview fires this long after the last option
   * change. Default: 800 ms — fast enough to feel responsive, slow enough
   * to avoid flooding the backend on slider drags.
   */
  debounceMs?: number;
}

export interface UseAnimePreviewResult {
  /** URL of the latest low-res preview frame. null while loading or on error. */
  previewUrl: string | null;
  /** True while a preview request is in-flight. */
  isLoading: boolean;
  /** Human-readable error message from the last failed request. */
  error: string | null;
  /** Manually trigger a new preview (bypasses debounce). */
  refresh: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 800;

export function useAnimePreview({
  clipId,
  options,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAnimePreviewOptions): UseAnimePreviewResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest request so stale responses from earlier requests are dropped
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!clipId || !enabled) return;

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/transform/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId,
          style: "anime",
          transformOptions: options,
        }),
        // 10-second hard timeout — preview must arrive within the 5-second
        // UI target; we give the network a 5-second grace on top.
        signal: AbortSignal.timeout(10_000),
      });

      // Discard if a newer request has already been fired
      if (currentRequestId !== requestIdRef.current) return;

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Preview request failed (HTTP ${res.status})`);
      }

      const data = await res.json() as { previewUrl?: string };
      if (!data.previewUrl) throw new Error("No preview URL in response");

      if (currentRequestId === requestIdRef.current) {
        setPreviewUrl(data.previewUrl);
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      // AbortError means the request was deliberately cancelled — not an error
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Unable to generate preview",
      );
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [clipId, enabled, options]);

  // Debounce: cancel the pending timer and restart it whenever options change
  useEffect(() => {
    if (!enabled || !clipId) {
      setPreviewUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPreview();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchPreview, enabled, clipId, debounceMs]);

  // Manual refresh bypasses the debounce
  const refresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    fetchPreview();
  }, [fetchPreview]);

  return { previewUrl, isLoading, error, refresh };
}
