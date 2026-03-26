"use client";

import React from "react";

interface PlanUsageProps {
  usage: number; // percentage
}

export default function PlanUsage({ usage }: PlanUsageProps) {
  const clampedUsage = Math.min(100, Math.max(0, usage));

  return (
    <div className="px-2 mb-6">
      <div className="rounded-xl bg-[#111111] p-4 border border-white/5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-[#00FF9D]/60 uppercase tracking-wider">
            Pro Plan Usage
          </span>
          <span className="text-xs font-bold text-white">{clampedUsage}%</span>
        </div>

        {/* Progress Bar Container */}
        <div className="relative mb-4 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-[#00FF9D] transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,255,157,0.3)]"
            style={{ width: `${clampedUsage}%` }}
          />
        </div>

        <button
          onClick={() => console.log("Upgrade modal triggered")}
          className="w-full rounded-lg bg-[#00E68A] py-2 text-sm font-bold text-white transition-all hover:bg-[#00FF9D] hover:text-black active:scale-[0.98] shadow-[0_0_20px_rgba(0,230,138,0.2)]"
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}
