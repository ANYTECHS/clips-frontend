import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="dashboard-main space-y-6 max-w-[900px] mx-auto w-full">
      {/* Page header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-5 w-20 rounded-lg animate-pulse bg-surface-hover" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-xl animate-pulse bg-surface-hover" />
          <Skeleton className="h-4 w-56 rounded-lg animate-pulse bg-surface-hover" />
        </div>
      </div>

      {/* Viewer skeleton */}
      <div className="bg-surface border border-border rounded-[24px] p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-lg animate-pulse bg-surface-hover" />
          <Skeleton className="h-8 w-24 rounded-xl animate-pulse bg-surface-hover" />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-input rounded-xl border border-border">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="flex-1 h-8 rounded-lg animate-pulse bg-surface-hover" />
          ))}
        </div>

        {/* Transaction rows */}
        <div className="space-y-2" aria-busy="true" aria-label="Loading transactions">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-border animate-pulse"
            >
              <div className="w-8 h-8 rounded-full bg-surface-hover shrink-0" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3.5 w-32 rounded bg-surface-hover" />
                <div className="h-3 w-48 rounded bg-surface-hover" />
                <div className="h-3 w-24 rounded bg-surface-hover" />
              </div>
              <div className="hidden sm:block space-y-2 text-right">
                <div className="h-3.5 w-20 rounded bg-surface-hover ml-auto" />
                <div className="h-3 w-14 rounded bg-surface-hover ml-auto" />
                <div className="h-3 w-16 rounded bg-surface-hover ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
