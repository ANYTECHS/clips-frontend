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

/**
 * StatCard — displays a single KPI metric.
 *
 * Wrapped in React.memo so parent re-renders that don't change props
 * skip this component entirely. The trendContent is additionally memoised
 * with useMemo to avoid reconstructing JSX on every render.
 *
 * Issue #874 – memoization for expensive computations.
 */
const StatCard = memo(function StatCard({ label, value, trend, icon: Icon, hideTrendIcon }: StatCardProps) {
  const trendContent = useMemo<React.ReactNode>(() => {
    if (typeof trend === "object" && trend !== null && "value" in trend && "label" in trend) {
      const num = (trend as { value: number }).value;
      const labelText = (trend as { label: string }).label;
      let icon: React.ReactNode;
      let color: string;

      if (num > 0) {
        color = "text-green-400";
        icon = <TrendingUp className="w-3 h-3 text-green-400" />;
      } else if (num < 0) {
        color = "text-red-400";
        icon = <TrendingDown className="w-3 h-3 text-red-400" />;
      } else {
        color = "text-muted-foreground";
        icon = <Minus className="w-3 h-3 text-muted-foreground" />;
      }

      return (
        <>
          {!hideTrendIcon && icon}
          <span className={color}>{labelText}</span>
        </>
      );
    }

    if (typeof trend === "string") {
      return <span>{trend}</span>;
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
});

export default StatCard;