"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  icon?: LucideIcon;
  hideTrendIcon?: boolean;
}

export default function StatCard({ label, value, trend, icon: Icon, hideTrendIcon }: StatCardProps) {
  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <span className="text-2xl font-extrabold text-white">{value}</span>
      {trend && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {!hideTrendIcon && <TrendingUp className="w-3 h-3 text-green-400" />}
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
