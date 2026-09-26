"use client";

/**
 * AnimeTransformControls
 *
 * Dedicated tuning panel for the "anime" transform style. Exposes:
 *   - Sub-style picker  (shōnen / shōjo / chibi / mecha / ghibli-inspired)
 *   - Color palette intensity slider  (0–100 %)
 *   - Outline thickness selector  (thin / medium / bold)
 *   - Background style selector  (original / painted / cel-shaded)
 *
 * This is a fully controlled component — the caller owns the state and
 * receives change notifications via `onChange`. Debounced preview requests
 * are handled by the parent through `onPreviewRequest`.
 *
 * Accessibility:
 *   - Every interactive element has a visible label and aria attributes
 *   - The slider emits aria-valuemin / aria-valuemax / aria-valuenow
 *   - Toggle groups use role="group" with aria-label
 *   - Keyboard navigation is native (tab + arrow for slider)
 */

import React, { useId } from "react";
import {
  ANIME_SUB_STYLE_META,
  ANIME_SUB_STYLES,
  OUTLINE_THICKNESS_META,
  OUTLINE_THICKNESSES,
  BACKGROUND_STYLE_META,
  BACKGROUND_STYLES,
  type AnimeTransformOptions,
  type AnimeSubStyle,
  type OutlineThickness,
  type BackgroundStyle,
} from "@/app/lib/animeTransform";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AnimeTransformControlsProps {
  /** Current option values (controlled). */
  value: AnimeTransformOptions;
  /** Called on every change. The parent decides when to debounce preview calls. */
  onChange: (next: AnimeTransformOptions) => void;
  /** When true, all controls are read-only (e.g. a job is in-flight). */
  disabled?: boolean;
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
      {children}
    </p>
  );
}

// ─── Sub-style pill grid ──────────────────────────────────────────────────────

interface SubStylePickerProps {
  selected: AnimeSubStyle;
  disabled: boolean;
  groupLabelId: string;
  onChange: (v: AnimeSubStyle) => void;
}

function SubStylePicker({ selected, disabled, groupLabelId, onChange }: SubStylePickerProps) {
  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="grid grid-cols-2 sm:grid-cols-3 gap-2"
    >
      {ANIME_SUB_STYLES.map((sub) => {
        const meta = ANIME_SUB_STYLE_META[sub];
        const isSelected = selected === sub;
        return (
          <button
            key={sub}
            type="button"
            onClick={() => !disabled && onChange(sub)}
            disabled={disabled}
            aria-pressed={isSelected}
            title={meta.description}
            className={[
              "relative flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              disabled
                ? "opacity-40 cursor-not-allowed border-white/5 bg-input"
                : isSelected
                  ? "border-brand/60 bg-surface shadow-[0_0_0_1px_var(--color-brand)]"
                  : "border-white/10 bg-input hover:border-brand/30 hover:bg-surface cursor-pointer",
            ].join(" ")}
          >
            <span
              className={[
                "text-[12px] font-bold leading-none",
                isSelected ? "text-brand" : "text-white",
              ].join(" ")}
            >
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
              {meta.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Intensity slider ─────────────────────────────────────────────────────────

interface IntensitySliderProps {
  value: number;
  disabled: boolean;
  inputId: string;
  onChange: (v: number) => void;
}

function IntensitySlider({ value, disabled, inputId, onChange }: IntensitySliderProps) {
  // Fill percentage drives the custom track colour
  const fillPct = `${value}%`;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-white"
        >
          Intensity
        </label>
        <output
          htmlFor={inputId}
          className="text-xs font-bold text-brand tabular-nums min-w-[2.5ch] text-right"
        >
          {value}%
        </output>
      </div>

      {/* Custom-styled range input — no extra JS library needed */}
      <div className="relative h-4 flex items-center">
        <div
          className="absolute left-0 right-0 h-1.5 rounded-full bg-input border border-white/5 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="h-full bg-brand rounded-full transition-none"
            style={{ width: fillPct }}
          />
        </div>
        <input
          id={inputId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-label={`Color palette intensity: ${value}%`}
          className={[
            "relative w-full appearance-none bg-transparent cursor-pointer",
            "focus-visible:outline-none",
            // Thumb styling via Tailwind's arbitrary value support
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-brand",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(0,255,133,0.5)]",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:w-4",
            "[&::-moz-range-thumb]:h-4",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-brand",
            "[&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-background",
            "[&::-moz-range-thumb]:cursor-pointer",
            disabled ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        />
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground font-medium select-none">
        <span>Muted</span>
        <span>Vivid</span>
      </div>
    </div>
  );
}

// ─── Segmented toggle (outline / background) ──────────────────────────────────

interface SegmentedToggleProps<T extends string> {
  options: readonly T[];
  labels: Record<T, string>;
  selected: T;
  disabled: boolean;
  groupLabelId: string;
  onChange: (v: T) => void;
}

function SegmentedToggle<T extends string>({
  options,
  labels,
  selected,
  disabled,
  groupLabelId,
  onChange,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="flex rounded-xl border border-white/10 bg-input overflow-hidden"
    >
      {options.map((opt, i) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => !disabled && onChange(opt)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={[
              "flex-1 py-2 text-[11px] font-bold transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
              i > 0 ? "border-l border-white/10" : "",
              disabled
                ? "opacity-40 cursor-not-allowed"
                : isSelected
                  ? "bg-surface text-brand"
                  : "text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer",
            ].join(" ")}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Anime-specific tuning controls.
 *
 * Renders inline below the style picker when "anime" is selected. All state
 * is owned by the parent; this component is purely presentational.
 *
 * @example
 * ```tsx
 * <AnimeTransformControls
 *   value={animeOptions}
 *   onChange={setAnimeOptions}
 *   disabled={isJobRunning}
 * />
 * ```
 */
export function AnimeTransformControls({
  value,
  onChange,
  disabled = false,
}: AnimeTransformControlsProps) {
  // Stable ids for accessible label associations
  const uid = useId();
  const subStyleLabelId = `${uid}-sub-style`;
  const outlineLabelId = `${uid}-outline`;
  const bgLabelId = `${uid}-bg`;
  const intensityInputId = `${uid}-intensity`;

  const outlineLabels = Object.fromEntries(
    OUTLINE_THICKNESSES.map((k) => [k, OUTLINE_THICKNESS_META[k].label]),
  ) as Record<OutlineThickness, string>;

  const bgLabels = Object.fromEntries(
    BACKGROUND_STYLES.map((k) => [k, BACKGROUND_STYLE_META[k].label]),
  ) as Record<BackgroundStyle, string>;

  return (
    <section
      aria-label="Anime style tuning options"
      className="mt-4 rounded-2xl border border-brand/20 bg-surface p-5 space-y-6 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* ── Sub-style ────────────────────────────────────────────── */}
      <div>
        <SectionLabel>
          <span id={subStyleLabelId}>Sub-style</span>
        </SectionLabel>
        <SubStylePicker
          selected={value.subStyle}
          disabled={disabled}
          groupLabelId={subStyleLabelId}
          onChange={(subStyle) => onChange({ ...value, subStyle })}
        />
      </div>

      {/* ── Color intensity ──────────────────────────────────────── */}
      <IntensitySlider
        value={value.colorIntensity}
        disabled={disabled}
        inputId={intensityInputId}
        onChange={(colorIntensity) => onChange({ ...value, colorIntensity })}
      />

      {/* ── Outline thickness ────────────────────────────────────── */}
      <div>
        <SectionLabel>
          <span id={outlineLabelId}>Outline</span>
        </SectionLabel>
        <SegmentedToggle
          options={OUTLINE_THICKNESSES}
          labels={outlineLabels}
          selected={value.outlineThickness}
          disabled={disabled}
          groupLabelId={outlineLabelId}
          onChange={(outlineThickness) => onChange({ ...value, outlineThickness })}
        />
      </div>

      {/* ── Background style ─────────────────────────────────────── */}
      <div>
        <SectionLabel>
          <span id={bgLabelId}>Background</span>
        </SectionLabel>
        <SegmentedToggle
          options={BACKGROUND_STYLES}
          labels={bgLabels}
          selected={value.backgroundStyle}
          disabled={disabled}
          groupLabelId={bgLabelId}
          onChange={(backgroundStyle) => onChange({ ...value, backgroundStyle })}
        />
      </div>
    </section>
  );
}
