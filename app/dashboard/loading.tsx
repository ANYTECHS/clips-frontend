import DashboardLayout from "@/components/shared/DashboardLayout";
import { DashboardPageSkeleton } from "@/components/shared/SkeletonPresets";

/**
 * Issue #1242 — route-level loading state for /dashboard.
 * Rendered inside the same DashboardLayout as the page so the sidebar and
 * header stay put and only the content area swaps (no layout shift).
 */
export default function DashboardLoading() {
  return (
    <DashboardLayout>
      <DashboardPageSkeleton />
    </DashboardLayout>
  );
}
