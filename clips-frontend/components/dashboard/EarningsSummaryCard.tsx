"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface EarningsSummaryCardProps {
  title: string;
  value: string;
  change: number; // percentage, e.g. 12.5 or -3.2 or 0
  icon: LucideIcon;
  /** Optional accent color override for the icon bg. Defaults to brand green. */
  accentColor?: string;
}

export default function EarningsSummaryCard({
  title,
  value,
  change,
  icon: Icon,
  accentColor,
}: EarningsSummaryCardProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const trendColor = isNeutral
    ? "text-[#8e9895]"
    : isPositive
    ? "text-emerald-400"
    : "text-rose-500";

  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  const formattedChange = isNeutral
    ? "No change"
    : `${isPositive ? "+" : ""}${change.toFixed(1)}%`;

  return (
    <div className="bg-[#111111] border border-white/5 rounded-[24px] p-6 sm:p-8 flex flex-col gap-5 relative overflow-hidden group hover:border-brand/20 transition-all duration-300">
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between">
        <span className="text-[#8e9895] text-[12px] sm:text-[13px] font-bold uppercase tracking-wider">
          {title}
        </span>
        <div
          className={
            accentColor
              ? "w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center transition-colors"
              : "w-10 h-10 rounded-xl bg-[#1A1A1A] border border-white/5 flex items-center justify-center text-[#5A6F65] group-hover:text-brand group-hover:bg-brand/5 transition-colors"
          }
          style={
            accentColor
              ? { backgroundColor: `${accentColor}15`, color: accentColor }
              : undefined
          }
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Value + trend */}
      <div className="flex items-end gap-3">
        <h3 className="text-[28px] sm:text-[32px] font-extrabold text-white leading-none font-mono tracking-tight">
          {value}
        </h3>
        <div
          className={`flex items-center gap-1 text-[12px] sm:text-[13px] font-bold pb-1 ${trendColor}`}
        >
          <TrendIcon className="w-4 h-4 shrink-0" />
          <span>{formattedChange}</span>
        </div>
      </div>

      {/* Trend label */}
      <p className="text-[#8e9895] text-[12px]">vs. last 30 days</p>

      {/* Hover bottom glow bar */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </div>
  );
}
