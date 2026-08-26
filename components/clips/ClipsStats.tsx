"use client";

import React from "react";
import { Film, TrendingUp, DollarSign } from "lucide-react";

interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
      <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-lg font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

export default function ClipsStats() {
  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white mb-6">Your Stats</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatChip
          icon={<Film className="w-4 h-4" />}
          label="Total Clips"
          value="24"
        />
        <StatChip
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Virality"
          value="8.5"
        />
        <StatChip
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Earnings"
          value="$1,240"
        />
      </div>
    </div>
  );
}
