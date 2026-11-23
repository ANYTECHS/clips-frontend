"use client";

import dynamic from "next/dynamic";
import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { AnalyticsPageSkeleton, ChartSkeleton } from "@/components/shared/SkeletonPresets";
import { getEarningsData } from "@/lib/queries";

const EarningsChart = dynamic(
  () => import("@/components/analytics/EarningsChart"),
  {
    ssr: false,
    loading: () => <ChartSkeleton />,
  },
);

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["earningsData"],
    queryFn: getEarningsData,
  });

  const totalXlm = data?.totalXlm || "0";
  const tipCount = data?.tipCount || 0;

  return (
    <DashboardLayout>
      {isLoading ? (
        <AnalyticsPageSkeleton />
      ) : (
        <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
          <div>
            <h1 className="text-2xl font-extrabold text-[#F4F7EF]">Analytics</h1>
            <p className="mt-1 text-sm text-[#90A89C]">Your earnings performance</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6">
              <div className="mb-3 flex items-center gap-2 text-[#90A89C]">
                <Wallet className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Total Earnings</span>
              </div>
              <p className="text-3xl font-extrabold text-[#F4F7EF]">{totalXlm} XLM</p>
            </div>
            <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#90A89C]">
                Total Tips
              </p>
              <p className="text-3xl font-extrabold text-[#F4F7EF]">{tipCount}</p>
            </div>
          </div>
          <EarningsChart totalXlm={totalXlm} />
        </div>
      )}
    </DashboardLayout>
  );
}
