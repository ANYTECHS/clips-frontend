"use client";

import React, { useMemo } from "react";
import { AlertCircle, Clock3, Loader2, RotateCcw, X } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";
import type { AnimeTransformOptions } from "@/app/lib/animeTransform";
import { useStylePreview } from "@/app/hooks/useStylePreview";

export interface StylePreviewCardProps {
  styleName: string;
  styleLabel: string;
  clipId: string | null;
  intensity: number;
  animeOptions: AnimeTransformOptions;
  enabled: boolean;
  onRemove?: () => void;
}

function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const safe = sanitize(value);
  if (safe.startsWith("/") || /^https?:\/\//i.test(safe)) return safe;
  return null;
}

function formatEstimate(seconds: number | null): string {
  if (!seconds) return "Calculating…";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  return `~${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
}

export function StylePreviewCard({
  styleName,
  styleLabel,
  clipId,
  intensity,
  animeOptions,
  enabled,
  onRemove,
}: StylePreviewCardProps) {
  const tuning = useMemo(
    () => (styleName === "anime" ? animeOptions : {}),
    [animeOptions, styleName]
  );
  const { previewUrl, sourceUrl, estimatedSeconds, isLoading, error, refresh, cancel } =
    useStylePreview({
      clipId,
      style: styleName,
      intensity,
      transformOptions: tuning,
      enabled,
    });

  const beforeUrl = safeImageUrl(sourceUrl) ?? "/projects/thumb1.png";
  const afterUrl = safeImageUrl(previewUrl) ?? `/styles/${sanitize(styleName)}.jpg`;

  return (
    <article className="rounded-2xl border border-white/10 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{sanitize(styleLabel)}</h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          {formatEstimate(estimatedSeconds)}
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${sanitize(styleLabel)} from comparison`}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <figure className="space-y-1">
          <figcaption className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Before
          </figcaption>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeUrl}
              alt="Original clip preview"
              className="h-full w-full object-cover"
            />
          </div>
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-[10px] font-bold uppercase tracking-wider text-brand">
            After
          </figcaption>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={afterUrl}
              alt={`${sanitize(styleLabel)} style preview`}
              className="h-full w-full object-cover"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2
                  className="h-5 w-5 animate-spin text-brand"
                  aria-label="Generating preview"
                />
              </div>
            )}
          </div>
        </figure>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {sanitize(error)}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={!isLoading && !previewUrl}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-white/5 disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel preview
        </button>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </button>
      </div>
    </article>
  );
}
