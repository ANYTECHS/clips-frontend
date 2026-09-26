/**
 * Streaming loading UI for the earnings page.
 *
 * Shown while page.tsx awaits fetchEarningsTransactions(). Matches the
 * earnings page layout: header row + 4 stat cards + table area.
 */
import EarningsLayout from "@/components/dashboard/EarningsLayout";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <EarningsLayout>
      <div className="space-y-8">
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 rounded-xl" />
            <Skeleton className="h-4 w-80 rounded-lg" />
          </div>
          <Skeleton className="h-11 w-28 rounded-xl" />
        </div>

        {/* Stat cards (4 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="w-9 h-9 rounded-xl" />
              </div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Transactions table */}
        <Skeleton className="h-80 w-full rounded-[24px]" />
      </div>
    </EarningsLayout>
  );
}
