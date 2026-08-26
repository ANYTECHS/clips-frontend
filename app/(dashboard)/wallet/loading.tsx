import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="dashboard-main space-y-8 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-4 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance hero */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-[24px] p-6 flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Donut */}
        <div className="bg-surface border border-border rounded-[24px] p-6 flex flex-col items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="w-32 h-32 rounded-full" />
        </div>
      </div>

      {/* Asset list */}
      <div className="bg-surface border border-border rounded-[24px] p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-border">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}