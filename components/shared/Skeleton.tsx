"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width utility or CSS value. */
  w?: string;
  /** Height utility or CSS value. */
  h?: string;
  rounded?: string;
}

/**
 * Issue #1380 — loading skeleton placeholder.
 * Matches the footprint of the content it replaces to avoid CLS; pulse
 * animation is disabled under prefers-reduced-motion via globals.css.
 */
export default function Skeleton({
  w = "w-full",
  h = "h-4",
  rounded = "rounded-lg",
  className = "",
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`${w} ${h} ${rounded} bg-[#0e4d2a]/60 animate-pulse ${className}`}
      {...rest}
    />
  );
}

/** Card-shaped skeleton for clip/project grids. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C]/60 p-4 space-y-3">
      <Skeleton h="h-40" rounded="rounded-xl" />
      <Skeleton w="w-2/3" h="h-4" />
      <Skeleton w="w-1/3" h="h-3" />
    </div>
  );
}
