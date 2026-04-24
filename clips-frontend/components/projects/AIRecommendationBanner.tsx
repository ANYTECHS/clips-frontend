"use client";

import React from "react";
import { Sparkles, Zap, X } from "lucide-react";

interface AIRecommendationBannerProps {
  recommendedCount: number;
  threshold: number;
  isActive: boolean;
  onAutoSelect: () => void;
  onToggle: () => void;
}

export default function AIRecommendationBanner({
  recommendedCount,
  threshold,
  isActive,
  onAutoSelect,
  onToggle,
}: AIRecommendationBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border transition-all duration-300 ${
        isActive
          ? "bg-brand/[0.06] border-brand/25"
          : "bg-white/[0.02] border-white/5"
      }`}
      role="region"
      aria-label="AI smart recommendations"
    >
      {/* Ambient glow when active */}
      {isActive && (
        <div className="absolute -top-8 -left-8 w-40 h-40 bg-brand/20 rounded-full blur-[50px] pointer-events-none" />
      )}

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
        {/* Icon + text */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isActive ? "bg-brand/15" : "bg-white/5"
            }`}
          >
            <Sparkles
              className={`w-4.5 h-4.5 transition-colors ${
                isActive ? "text-brand" : "text-muted-foreground"
              }`}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white leading-tight">
              AI Smart Recommendations
            </p>
            <p className="text-[12px] text-muted mt-0.5">
              {isActive ? (
                <>
                  <span className="text-brand font-bold">{recommendedCount} clips</span>
                  {" "}scored above {threshold}% — ready to auto-select
                </>
              ) : (
                <>Enable to highlight clips scoring above {threshold}%</>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto Select button — only shown when active */}
          {isActive && (
            <button
              onClick={onAutoSelect}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-black text-[12px] font-black uppercase tracking-wider hover:bg-brand-hover active:scale-[0.97] transition-all shadow-[0_0_16px_rgba(0,229,143,0.25)]"
              aria-label={`Auto-select ${recommendedCount} recommended clips`}
            >
              <Zap className="w-3.5 h-3.5 fill-black" aria-hidden="true" />
              Auto Select
            </button>
          )}

          {/* Toggle */}
          <button
            onClick={onToggle}
            role="switch"
            aria-checked={isActive}
            aria-label={`${isActive ? "Disable" : "Enable"} AI recommendations`}
            className={`relative w-11 h-6 rounded-full border transition-all duration-300 shrink-0 ${
              isActive
                ? "bg-brand/20 border-brand/40"
                : "bg-white/5 border-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 shadow-sm ${
                isActive
                  ? "left-[22px] bg-brand shadow-[0_0_8px_rgba(0,229,143,0.6)]"
                  : "left-0.5 bg-muted-foreground"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
