/**
 * Streaming loading UI for the analytics page.
 *
 * Shown while page.tsx awaits fetchAnalyticsData(). Matches the analytics
 * layout: header + filters row, 3 stat cards, 2 chart panels.
 */
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        {/* Header + filter controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-52 rounded-xl" />
            <Skeleton className="h-4 w-72 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>

        {/* Stat cards (3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="w-9 h-9 rounded-xl" />
              </div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>

        {/* Two chart/table panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-60 w-full rounded-[24px]" />
          <Skeleton className="h-60 w-full rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}
