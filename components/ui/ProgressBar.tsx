"use client";

/**
 * Compositor-friendly progress bar (#879).
 *
 * The progress bars across the app animated their `width` with
 * `transition-all`, which forces layout and paint on every frame of every
 * animating bar — the upload screen runs one per file. This fills the track
 * with a full-width element and scales it on the X axis instead, so the
 * animation runs on the compositor and touches neither layout nor paint.
 *
 * `transition-transform` rather than `transition-all` keeps the browser from
 * watching every other animatable property for changes it will never see.
 *
 * `prefers-reduced-motion` is honoured globally in `app/globals.css`, which
 * collapses transition durations; nothing extra is needed here.
 */

import React from "react";

export interface ProgressBarProps {
  /** Progress percentage. Values outside 0–100 are clamped. */
  value: number;
  /** Class names for the filled portion — colour, glow, and so on. */
  fillClassName?: string;
  /** Class names for the track. */
  className?: string;
  /** Transition duration in milliseconds. */
  durationMs?: number;
  /** Accessible label, when the surrounding context does not supply one. */
  label?: string;
}

/** Clamp to the 0–100 range a progress bar can actually render. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function ProgressBar({
  value,
  fillClassName = "bg-brand",
  className = "h-1.5 w-full rounded-full bg-white/10",
  durationMs = 300,
  label,
}: ProgressBarProps) {
  const percent = clampPercent(value);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        data-testid="progress-bar-fill"
        className={`absolute inset-0 rounded-full transition-transform ease-out will-change-transform ${fillClassName}`}
        style={{
          // scaleX from a left origin is the compositor-only equivalent of
          // animating width from 0.
          transform: `scaleX(${percent / 100})`,
          transformOrigin: "left center",
          transitionDuration: `${durationMs}ms`,
        }}
      />
    </div>
  );
}

export default React.memo(ProgressBar);
