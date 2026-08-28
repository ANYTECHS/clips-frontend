"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { StyleCard } from "./StyleCard";
import type { TransformStyle } from "@/app/api/transform/styles/route";
import type { ApiResponse } from "@/app/api/types";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StylePickerProps {
  /**
   * The currently selected style name (controlled).
   * Pass `null` or `undefined` for no selection.
   */
  selectedStyle?: string | null;
  /**
   * When true, all style cards are rendered in their disabled state.
   * Useful while a transformation job is already in-flight.
   */
  disabled?: boolean;
  /**
   * Called when the user selects a style.
   * The argument is the style's machine name (e.g. "anime").
   */
  onStyleSelect?: (styleName: string) => void;
  /**
   * Called immediately after a style is selected to trigger a low-res preview.
   * Passes the selected style name.
   */
  onPreviewRequest?: (styleName: string) => void;
}

// ─── Fetch hook ───────────────────────────────────────────────────────────────

interface UseStylesResult {
  styles: TransformStyle[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Fetches available transform styles from the API with automatic retry on failure.
 * @returns Styles array, loading state, error message, and retry function
 */
function useStyles(): UseStylesResult {
  const [styles, setStyles] = useState<TransformStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchStyles = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/transform/styles");
        if (!res.ok) {
          throw new Error(`Failed to load styles (HTTP ${res.status})`);
        }
        const body = (await res.json()) as ApiResponse<TransformStyle[]>;
        if (body.error || !body.data) {
          throw new Error(body.error ?? "No styles returned from server");
        }
        if (!cancelled) {
          setStyles(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load transformation styles. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStyles();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { styles, loading, error, retry };
}

// ─── Skeleton grid ─────────────────────────────────────────────────────────---

function StylePickerSkeleton() {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-busy="true"
      aria-label="Loading styles…"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden border border-white/5 bg-input"
          aria-hidden="true"
        >
          {/* Thumbnail placeholder */}
          <Skeleton className="w-full aspect-video animate-pulse bg-white/5" />
          {/* Body placeholder */}
          <div className="p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <Skeleton className="h-3.5 w-2/5 rounded animate-pulse bg-white/5" />
              <Skeleton className="h-3.5 w-1/4 rounded animate-pulse bg-white/5" />
            </div>
            <Skeleton className="h-3 w-full rounded animate-pulse bg-white/5" />
            <Skeleton className="h-3 w-3/4 rounded animate-pulse bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function StylePickerError({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <AlertCircle className="w-10 h-10 text-red-400" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-white font-bold text-sm">Failed to load styles</p>
        <p className="text-muted-foreground text-xs max-w-xs">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-white font-bold text-xs transition-all"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * StylePicker
 *
 * Fetches available AI transformation styles from GET /api/transform/styles
 * and renders a responsive grid of selectable style cards. Selecting a card
 * also fires `onPreviewRequest` to trigger a low-res fast preview before full
 * processing begins.
 */
export function StylePicker({
  selectedStyle,
  disabled = false,
  onStyleSelect,
  onPreviewRequest,
}: StylePickerProps) {
  const { styles, loading, error, retry } = useStyles();

  const handleSelect = useCallback(
    (name: string) => {
      if (disabled) return;
      onStyleSelect?.(name);
      onPreviewRequest?.(name);
    },
    [disabled, onStyleSelect, onPreviewRequest],
  );

  if (loading) {
    return <StylePickerSkeleton />;
  }

  if (error) {
    return <StylePickerError message={error} onRetry={retry} />;
  }

  if (styles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-white font-bold text-sm">No styles available</p>
        <p className="text-muted-foreground text-xs">
          No transformation styles are configured yet.
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Select a transformation style"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {styles.map((style) => (
        <StyleCard
          key={style.name}
          style={style}
          isSelected={selectedStyle === style.name}
          isDisabled={disabled}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
