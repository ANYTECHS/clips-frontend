import React from "react";
import Skeleton from "./Skeleton";

interface SkeletonCardProps {
  /** Whether to show a top icon/label row. Default true. */
  showHeader?: boolean;
  /** Height class for the value area. Default h-8. */
  valueHeight?: string;
  className?: string;
}

/**
 * SkeletonCard — layout-matched placeholder for stat / info cards.
 *
 * Mirrors the proportions of StatCard and EarningsSummaryCards so there is
 * no layout shift when real data arrives.
 *
 * Issue #871 – skeleton screens for slow-loading content.
 */
export default function SkeletonCard({
  showHeader = true,
  valueHeight = "h-8",
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      className={`bg-surface border border-white/5 rounded-2xl p-6 flex flex-col gap-3 ${className}`}
      aria-hidden="true"
    >
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-5 w-5 rounded" />
        </div>
      )}
      <Skeleton className={`${valueHeight} w-32 rounded`} />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
  );
}
