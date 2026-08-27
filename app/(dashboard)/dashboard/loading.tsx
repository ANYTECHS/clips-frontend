/**
 * Streaming loading UI for the dashboard home page.
 *
 * Next.js streams this component while the async server component (page.tsx)
 * awaits its data fetch. It covers only the page content area — the shell
 * chrome (sidebar, header) is already rendered by the server layout and does
 * not need to be duplicated here.
 */
import RouteSkeleton from "@/components/ui/RouteSkeleton";

export default function Loading() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-10 min-w-0">
      {/* Page heading placeholder */}
      <div className="flex flex-col gap-2 mb-8 px-2">
        <div className="h-9 w-48 rounded-xl bg-white/5 animate-pulse" />
        <div className="h-4 w-80 rounded-lg bg-white/5 animate-pulse" />
      </div>

      {/* Stat cards + chart */}
      <RouteSkeleton
        variant="stats"
        maxWidthClass="max-w-[1400px]"
        count={3}
      />
    </div>
  );
}
