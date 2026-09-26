"use client";

import React, { useMemo, useState } from "react";
import { X, Wand2, Loader2, Sparkles, Clock3 } from "lucide-react";
import { StylePicker } from "@/components/transform/StylePicker";
import { AnimeTransformControls } from "@/components/transform/AnimeTransformControls";
import { StylePreviewCard } from "@/components/transform/StylePreviewCard";
import { DEFAULT_ANIME_OPTIONS, type AnimeTransformOptions } from "@/app/lib/animeTransform";
import { sanitize } from "@/app/lib/sanitize";
import { TRANSFORM_STYLES } from "@/app/lib/transformStyles";
import type { TransformOptions } from "@/app/api/transform/batch/route";
import { useWillChange } from "@/app/hooks/useWillChange";

export interface BatchTransformModalProps {
  /** Number of clips selected. */
  clipCount: number;
  /** Representative owned clip used to generate low-resolution previews. */
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
  const panelRef = useWillChange<HTMLDivElement>("transform, opacity");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(70);
  const [animeOptions, setAnimeOptions] = useState<AnimeTransformOptions>(DEFAULT_ANIME_OPTIONS);
  const [comparisonStyles, setComparisonStyles] = useState<string[]>([]);

  const isAnime = selectedStyle === "anime";
  const comparisonItems = useMemo(
    () =>
      comparisonStyles
        .map((name) => TRANSFORM_STYLES.find((style) => style.name === name))
        .filter((style): style is (typeof TRANSFORM_STYLES)[number] => Boolean(style)),
    [comparisonStyles]
  );

  const handleStyleSelect = (style: string) => {
    setSelectedStyle(style);
    setComparisonStyles((current) =>
      [style, ...current.filter((name) => name !== style)].slice(0, 3)
    );
  };

  const toggleComparison = (style: string) => {
    setComparisonStyles((current) => {
      if (current.includes(style)) {
        return current.filter((name) => name !== style);
      }
      return [...current, style].slice(-3);
    });
  };

  const handleIntensityChange = (value: number) => {
    setIntensity(value);
    if (isAnime) {
      setAnimeOptions((options) => ({ ...options, colorIntensity: value }));
    }
  };

  const handleConfirm = () => {
    if (!selectedStyle || isSubmitting) return;
    const options: TransformOptions = {
      intensity,
      ...(isAnime ? { animeOptions: { ...animeOptions, colorIntensity: intensity } } : {}),
    };
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
        ref={panelRef}
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
              <h2 id="batch-transform-modal-title" className="text-base font-extrabold text-white">
                {safeCount === 1 ? "Transform Clip" : "Batch Transform"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Applying AI style to <span className="text-white font-bold">{safeCount}</span> clip
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
            onStyleSelect={handleStyleSelect}
          />

          {isAnime && (
            <AnimeTransformControls
              value={animeOptions}
              onChange={(next) => {
                setAnimeOptions(next);
                setIntensity(next.colorIntensity);
              }}
              disabled={isSubmitting}
            />
          )}

          <section
            className="mt-4 rounded-2xl border border-white/10 bg-surface p-4"
            aria-label="Style intensity"
          >
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="style-intensity"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Style intensity
              </label>
              <span className="text-sm font-bold text-brand">{intensity}%</span>
            </div>
            <input
              id="style-intensity"
              type="range"
              min={0}
              max={100}
              step={1}
              value={intensity}
              disabled={isSubmitting}
              onChange={(event) => handleIntensityChange(Number(event.target.value))}
              className="mt-3 w-full accent-brand"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={intensity}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Lower values stay closer to the source; higher values apply a stronger effect.
            </p>
          </section>

          {previewClipId && selectedStyle && (
            <section className="mt-5 space-y-3" aria-label="Style preview comparison">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Compare style previews
                </h3>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  low resolution
                </span>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Styles to preview">
                {TRANSFORM_STYLES.map((style) => {
                  const active = comparisonStyles.includes(style.name);
                  return (
                    <button
                      key={style.name}
                      type="button"
                      disabled={isSubmitting || (!active && comparisonStyles.length >= 3)}
                      onClick={() => toggleComparison(style.name)}
                      aria-pressed={active}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-white/10 text-white/70 hover:bg-white/5"
                      }`}
                    >
                      {sanitize(style.label)}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {comparisonItems.map((style) => (
                  <StylePreviewCard
                    key={style.name}
                    styleName={style.name}
                    styleLabel={style.label}
                    clipId={previewClipId}
                    intensity={intensity}
                    animeOptions={animeOptions}
                    enabled={!isSubmitting}
                    onRemove={
                      comparisonStyles.length > 1 ? () => toggleComparison(style.name) : undefined
                    }
                  />
                ))}
              </div>
            </section>
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
