import React from "react";

interface SkeletonProps {
  className?: string;
  /** Visual variant. "shimmer" adds a moving highlight (default). "pulse" fades in/out. */
  variant?: "shimmer" | "pulse";
}

/**
 * Skeleton — placeholder for slow-loading content.
 *
 * Renders a rounded rectangle with a shimmer or pulse animation that matches
 * the final content layout so layout shift is minimised when real content arrives.
 *
 * Issue #871 – shimmer effect and consistent dark-surface base added.
 */
export default function Skeleton({ className, variant = "shimmer" }: SkeletonProps) {
  const base = "rounded bg-white/[0.06] overflow-hidden relative";

  if (variant === "shimmer") {
    return (
      <div className={`${base} ${className ?? ""}`} aria-hidden="true">
        {/* Moving highlight */}
        <span
          className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
          style={{ willChange: "transform" }}
        />
      </div>
    );
  }

  // "pulse" variant – simple opacity animation
  return (
    <div
      className={`${base} animate-pulse ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
