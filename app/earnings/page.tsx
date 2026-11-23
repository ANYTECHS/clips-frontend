"use client";

import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/shared/DashboardLayout";
import EarningsTable, { type EarningsRow } from "@/components/dashboard/EarningsTable";
import { EarningsPageSkeleton } from "@/components/shared/SkeletonPresets";
import { getEarningsData } from "@/lib/queries";

export default function EarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["earningsData"],
    queryFn: getEarningsData,
  });

  const totalXlm = data?.totalXlm || "0";
  const tipCount = data?.tipCount || 0;
  const rows: EarningsRow[] = (data?.recentTips || []).map((tip: any) => ({
    id: tip.id,
    senderAddress: tip.senderAddress,
    clipTitle: tip.clipTitle || tip.clip?.title || null,
    amount: tip.amount,
    createdAt: tip.createdAt,
    status: tip.status,
  }));

  return (
    <DashboardLayout>
      {isLoading ? (
        <EarningsPageSkeleton />
      ) : (
        <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10">
          <div>
            <h1 className="text-2xl font-extrabold text-[#F4F7EF]">Earnings</h1>
            <p className="mt-1 text-sm text-[#90A89C]">Tips received on your clips</p>
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

          <EarningsTable rows={rows} />
        </div>
      )}
    </DashboardLayout>
  );
}
