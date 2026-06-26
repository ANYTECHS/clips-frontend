"use client";

import React, { useEffect } from "react";
import { useEarningsStore } from "@/app/store/earningsStore";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

interface TrendProps {
  change: number;
}

function TrendIndicator({ change }: TrendProps) {
  if (change > 0) {
    return (
      <div className="flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-xs font-medium">
        <ArrowUpRight className="w-3 h-3" />
        <span>+{change.toFixed(1)}%</span>
      </div>
    );
  }
  if (change < 0) {
    return (
      <div className="flex items-center gap-1 text-red-500 bg-red-500/10 px-2 py-1 rounded-full text-xs font-medium">
        <ArrowDownRight className="w-3 h-3" />
        <span>{change.toFixed(1)}%</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2 py-1 rounded-full text-xs font-medium text-neutral-400">
      <Minus className="w-3 h-3" />
      <span>Steady</span>
    </div>
  );
}

export default function EarningsSummaryCards() {
  const { fetchEarnings, totalFiat, cryptoRevenue, pendingPayouts, loading } = useEarningsStore();

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  if (loading && totalFiat.value === "$0.00") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-6">
            <Skeleton className="h-4 w-24 mb-4" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Total Fiat Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <h3 className="text-muted text-sm font-medium z-10">Total Fiat (USD)</h3>
        <div className="flex items-end justify-between z-10">
          <span className="text-3xl font-bold text-white">{totalFiat.value}</span>
          <TrendIndicator change={totalFiat.change} />
        </div>
      </div>

      {/* Crypto Revenue Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <h3 className="text-muted text-sm font-medium z-10">Crypto Revenue</h3>
        <div className="flex items-end justify-between z-10">
          <span className="text-3xl font-bold text-white">{cryptoRevenue.value}</span>
          <TrendIndicator change={cryptoRevenue.change} />
        </div>
      </div>

      {/* Pending Payouts Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <h3 className="text-muted text-sm font-medium z-10">Pending Payouts</h3>
        <div className="flex items-end justify-between z-10">
          <span className="text-3xl font-bold text-white">{pendingPayouts.value}</span>
          <TrendIndicator change={pendingPayouts.change} />
        </div>
      </div>
    </div>
  );
}
