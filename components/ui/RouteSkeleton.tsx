import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export type RouteSkeletonVariant = "stats" | "form" | "list" | "cards";

export interface RouteSkeletonProps {
  /**
   * Shape of the page being loaded. Picking the closest match keeps the
   * skeleton roughly the size of the real content, so the page does not jump
   * when it arrives.
   */
  variant?: RouteSkeletonVariant;
  /** Matches the page's own container width so the skeleton lines up with it. */
  maxWidthClass?: string;
  /** Rows or cards to draw, where the variant uses a repeated block. */
  count?: number;
}

function PageHeading() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Loading placeholder shared by the dashboard routes.
 *
 * Every route segment needs its own `loading.tsx` for Next.js to stream it, but
 * the skeletons themselves are near-identical. Keeping the shapes here means a
 * route file is a three-line declaration of which shape it wants.
 */
export default function RouteSkeleton({
  variant = "stats",
  maxWidthClass = "max-w-[1200px]",
  count = 3,
}: RouteSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div
      className={`dashboard-main space-y-6 ${maxWidthClass} mx-auto w-full`}
      role="status"
      aria-busy="true"
      aria-label="Loading page"
    >
      <PageHeading />

      {variant === "stats" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="w-10 h-10 rounded-xl" />
                </div>
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-[320px] w-full rounded-[24px]" />
        </>
      )}

      {variant === "form" && (
        <div className="space-y-6">
          {items.map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-[24px] p-6 sm:p-8 space-y-4"
            >
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Skeleton className="h-11 w-full rounded-xl" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === "list" && (
        <div className="bg-surface border border-border rounded-[24px] p-5 sm:p-6 space-y-3">
          {items.map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-hover/50"
            >
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {variant === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-[24px] p-6 space-y-4"
            >
              <Skeleton className="h-32 w-full rounded-[18px]" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      <span className="sr-only">Loading&hellip;</span>
    </div>
  );
}
