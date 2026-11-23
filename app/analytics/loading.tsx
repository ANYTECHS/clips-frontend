import DashboardLayout from "@/components/shared/DashboardLayout";
import { AnalyticsPageSkeleton } from "@/components/shared/SkeletonPresets";

/**
 * Issue #1242 — route-level loading state for /analytics.
 * Rendered inside the same DashboardLayout as the page so the sidebar and
 * header stay put and only the content area swaps (no layout shift).
 */
export default function AnalyticsLoading() {
  return (
    <DashboardLayout>
      <AnalyticsPageSkeleton />
    </DashboardLayout>
  );
}
