"use client";

import React, { memo, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type TrendValue = { value: number; label: string } | string;

interface StatCardProps {
  label: string;
  value: string;
  trend?: TrendValue;
  icon?: LucideIcon;
  hideTrendIcon?: boolean;
  /** @deprecated pass trend as { value, label } object instead */
  isPositive?: boolean;
}

function StatCard({ label, value, trend, icon: Icon, hideTrendIcon }: StatCardProps) {
  let trendContent: React.ReactNode = null;
  let trendColor = "text-muted-foreground";

  if (typeof trend === "object" && trend !== null && "value" in trend && "label" in trend) {
    const num = (trend as { value: number }).value;
    const labelText = (trend as { label: string }).label;

    if (num > 0) {
      trendColor = "text-green-400";
      trendContent = <TrendingUp className="w-3 h-3 text-green-400" />;
    } else if (num < 0) {
      trendColor = "text-red-400";
      trendContent = <TrendingDown className="w-3 h-3 text-red-400" />;
    } else {
      trendContent = <Minus className="w-3 h-3 text-muted-foreground" />;
    }

    return null;
  }, [trend, hideTrendIcon]);

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <span className="text-2xl font-extrabold text-white">{value}</span>
      {trend && <div className="flex items-center gap-1 text-xs text-muted-foreground">{trendContent}</div>}
    </div>
  );
}

/**
 * Purely presentational: every prop is a primitive or a module-scope icon
 * component, so a shallow prop comparison is enough to skip re-rendering the
 * card when an unrelated slice of dashboard state changes.
 */
export default React.memo(StatCard);
