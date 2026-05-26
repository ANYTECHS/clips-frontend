"use client";

import React, { useEffect } from "react";
import { DollarSign, Clock } from "lucide-react";
import EarningsSummaryCard from "./EarningsSummaryCard";
import { useEarningsStore, selectEarningsTotals, selectEarningsMeta } from "@/app/store";

// Ethereum icon as a simple inline SVG component (not in lucide-react)
function EthIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2L4.5 12.5 12 16l7.5-3.5L12 2z" />
      <path d="M4.5 12.5L12 22l7.5-9.5" />
      <path d="M12 16v-6" />
    </svg>
  );
}

// Wrap EthIcon so it matches the LucideIcon interface expected by EarningsSummaryCard
const EthLucideCompat = EthIcon as unknown as React.ComponentType<{
  className?: string;
}>;

export interface EarningsSummaryData {
  totalFiat: { value: string; change: number };
  cryptoRevenue: { value: string; change: number };
  pendingPayouts: { value: string; change: number };
}

interface EarningsSummaryCardsProps {
  data?: EarningsSummaryData;
}

export default function EarningsSummaryCards({
  data: propData,
}: EarningsSummaryCardsProps) {
  const { fetchEarnings } = useEarningsStore();
  const storeTotals = useEarningsStore(selectEarningsTotals);
  const { loading } = useEarningsStore(selectEarningsMeta);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const data = propData || storeTotals;

  if (loading && !propData && data.totalFiat.value === "$0.00") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="bg-surface/50 border border-border/50 rounded-[24px] h-[160px] animate-pulse" 
          />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <EarningsSummaryCard
        title="Total Fiat Earnings"
        value={data.totalFiat.value}
        change={data.totalFiat.change}
        icon={DollarSign}
      />
      <EarningsSummaryCard
        title="Crypto Revenue (ETH)"
        value={data.cryptoRevenue.value}
        change={data.cryptoRevenue.change}
        icon={EthLucideCompat as any}
        accentColor="var(--color-brand)"
      />
      <EarningsSummaryCard
        title="Pending Payouts"
        value={data.pendingPayouts.value}
        change={data.pendingPayouts.change}
        icon={Clock}
        accentColor="var(--color-muted)"
      />
    </div>
  );
}
