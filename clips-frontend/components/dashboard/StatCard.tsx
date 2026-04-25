"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  trend: string;
  isPositive?: boolean;
  icon: LucideIcon;
  hideTrendIcon?: boolean;
}

export default function StatCard({ label, value, trend, isPositive = true, icon: Icon, hideTrendIcon = false }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-6 relative overflow-hidden group hover:border-brand/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-muted text-[13px] font-bold uppercase tracking-wider">{label}</span>
        <div className="w-10 h-10 rounded-xl bg-surface-hover border border-border flex items-center justify-center text-muted-foreground group-hover:text-brand group-hover:bg-brand/5 transition-colors">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="flex items-end gap-3">
        <h3 className="text-[32px] font-extrabold text-white leading-none font-mono">{value}</h3>
        <div className={`flex items-center gap-1 text-[13px] font-bold pb-1 ${isPositive ? "text-brand" : "text-error"}`}>
          {!hideTrendIcon && (isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />)}
          <span>{trend}</span>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand/10 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </div>
  );
}
