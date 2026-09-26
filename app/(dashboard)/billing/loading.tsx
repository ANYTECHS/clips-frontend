/**
 * Streaming loading UI for the billing page.
 *
 * Shown while page.tsx awaits fetchBillingPlans() + fetchUserProfile().
 * Matches the billing layout: header section, current-plan card, plan grid.
 */
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-10 py-6">
      {/* Page header */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-4 w-[480px] max-w-full rounded-lg" />
      </div>

      {/* Current plan summary card */}
      <div className="bg-surface border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-7 w-32 rounded-xl" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-3 w-28 rounded ml-auto" />
            <Skeleton className="h-7 w-36 rounded-xl ml-auto" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-52 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      </div>

      {/* Plan cards grid */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-surface border border-white/10 rounded-3xl p-6 space-y-5"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-24 rounded-lg" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
              <Skeleton className="h-10 w-28 rounded-xl" />
              <div className="space-y-2 pt-2 border-t border-white/5">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton className="h-3 w-full rounded" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-11 w-full rounded-xl mt-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
