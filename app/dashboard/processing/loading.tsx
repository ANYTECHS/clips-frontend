import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/shared/DashboardLayout";

/**
 * Issue #1242 — keeps /dashboard/processing from inheriting the dashboard
 * overview skeleton from the parent segment's loading.tsx.
 */
export default function ProcessingLoading() {
  return (
    <DashboardLayout showHeader={false}>
      <div className="flex-1 flex items-center justify-center text-white" role="status" aria-label="Loading">
        <RefreshCw className="w-6 h-6 animate-spin text-[#B6FF4A]" />
      </div>
    </DashboardLayout>
  );
}
