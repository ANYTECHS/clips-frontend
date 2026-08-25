"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Wand2, Loader2, Sparkles } from "lucide-react";
import { StylePicker } from "@/components/transform/StylePicker";
import { AnimeTransformControls } from "@/components/transform/AnimeTransformControls";
import { useAnimePreview } from "@/app/hooks/useAnimePreview";
import { DEFAULT_ANIME_OPTIONS, type AnimeTransformOptions } from "@/app/lib/animeTransform";
import { sanitize } from "@/app/lib/sanitize";
import type { TransformOptions } from "@/app/api/transform/batch/route";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BatchTransformModalProps {
  /** Number of clips selected. */
  clipCount: number;
  /**
   * A representative clip id for live preview. When provided, the anime
   * controls will fire a low-res preview as the user tunes options.
   * Pass null when no individual clip can be identified (batch of > 1).
   */
  previewClipId?: string | null;
  /** Whether the submission is currently in-flight. */
  isSubmitting: boolean;
  /** An error message from the last failed submission, if any. */
  submitError: string | null;
  /** Called when the user confirms their style selection. */
  onConfirm: (style: string, options?: TransformOptions) => void;
  /** Called when the user closes the modal. */
  onClose: () => void;
}

// ─── Preview thumbnail ────────────────────────────────────────────────────────

interface PreviewThumbnailProps {
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

function PreviewThumbnail({ previewUrl, isLoading, error }: PreviewThumbnailProps) {
  if (!previewUrl && !isLoading && !error) return null;

  return (
    <div className="mt-4 rounded-xl border border-brand/20 bg-input overflow-hidden">
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <Sparkles className="w-3 h-3 text-brand" aria-hidden="true" />
        <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
          Live Preview
        </span>
        {isLoading && (
          <span className="text-[10px] text-muted-foreground ml-auto animate-pulse">
            Generating…
          </span>
        )}
      </div>

      <div className="relative aspect-video bg-black flex items-center justify-center">
        {previewUrl && (
          <Image
            src={previewUrl}
            alt="Low-res anime style preview"
            fill
            className="object-contain"
          />
        )}
        {isLoading && !previewUrl && (
          <Loader2 className="w-6 h-6 text-brand animate-spin" aria-label="Generating preview" />
        )}
        {/* Overlay spinner on top of existing preview while refreshing */}
        {isLoading && previewUrl && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-brand animate-spin" aria-label="Updating preview" />
          </div>
        )}
        {error && !previewUrl && (
          <p className="text-[11px] text-muted-foreground px-4 text-center">{sanitize(error)}</p>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Modal dialog for initiating a batch (or single) AI video transformation.
 *
 * When the user selects the "anime" style, a dedicated `AnimeTransformControls`
 * panel slides in below the style grid, with a live low-res preview that
 * updates within 5 seconds of any option change.
 */
export function BatchTransformModal({
  clipCount,
  previewClipId = null,
  isSubmitting,
  submitError,
  onConfirm,
  onClose,
}: BatchTransformModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [animeOptions, setAnimeOptions] = useState<AnimeTransformOptions>(DEFAULT_ANIME_OPTIONS);

  const isAnime = selectedStyle === "anime";

  // Live preview — only fires when anime is selected and a clip id is available
  const {
    previewUrl,
    isLoading: isPreviewLoading,
    error: previewError,
  } = useAnimePreview({
    clipId: isAnime ? previewClipId : null,
    options: animeOptions,
    enabled: isAnime && !!previewClipId,
  });

  const handleConfirm = () => {
    if (!selectedStyle || isSubmitting) return;
    const options: TransformOptions | undefined = isAnime
      ? { animeOptions }
      : undefined;
    onConfirm(selectedStyle, options);
  };

  const safeError = submitError ? sanitize(submitError) : null;
  const safeCount = Math.max(0, Math.floor(clipCount));

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-transform-modal-title"
    >
      {/* Panel */}
      <div
        className={[
          "relative w-full max-w-2xl bg-surface border border-white/10 rounded-3xl",
          "shadow-2xl flex flex-col overflow-hidden",
          "animate-in zoom-in-95 fade-in duration-200",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="batch-transform-modal-title"
                className="text-base font-extrabold text-white"
              >
                {safeCount === 1 ? "Transform Clip" : "Batch Transform"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Applying AI style to{" "}
                <span className="text-white font-bold">{safeCount}</span> clip
                {safeCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close transform dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[70vh] space-y-1">
          {/* Style picker */}
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
            Choose a style
          </p>
          <StylePicker
            selectedStyle={selectedStyle}
            disabled={isSubmitting}
            onStyleSelect={setSelectedStyle}
          />

          {/* Anime-specific controls — animate in when anime is selected */}
          {isAnime && (
            <>
              <AnimeTransformControls
                value={animeOptions}
                onChange={setAnimeOptions}
                disabled={isSubmitting}
              />

              {/* Live preview thumbnail */}
              {previewClipId && (
                <PreviewThumbnail
                  previewUrl={previewUrl}
                  isLoading={isPreviewLoading}
                  error={previewError}
                />
              )}
            </>
          )}
        </div>

        {/* Error banner */}
        {safeError && (
          <div className="mx-6 mb-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {safeError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-bold text-gray-300 hover:bg-white/5 hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={!selectedStyle || isSubmitting}
            className={[
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              selectedStyle && !isSubmitting
                ? "bg-brand text-black hover:bg-brand/90"
                : "bg-brand/30 text-black/50 cursor-not-allowed",
            ].join(" ")}
            aria-disabled={!selectedStyle || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Starting…
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" aria-hidden="true" />
                Transform {safeCount} clip{safeCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
