"use client";

import React, { useState } from "react";

export interface ScoreBreakdown {
  hook: number;
  retention: number;
  emotional: number;
  trending: number;
}

export interface ScoreBreakdownTooltipProps {
  score: number;
  scoreKey?: "high" | "medium" | "low" | string;
  scoreBreakdown?: ScoreBreakdown;
  className?: string;
}

export default function ScoreBreakdownTooltip({
  score,
  scoreKey,
  scoreBreakdown,
  className = "",
}: ScoreBreakdownTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fallback breakdown if not provided explicitly
  const breakdown: ScoreBreakdown = scoreBreakdown ?? {
    hook: Math.min(100, Math.round(score * 1.02)),
    retention: Math.max(0, Math.round(score * 0.95)),
    emotional: Math.min(100, Math.round(score * 0.98)),
    trending: Math.max(0, Math.round(score * 1.01)),
  };

  const badgeColor =
    scoreKey === "high" || score >= 80
      ? "bg-green-500/80 text-white"
      : scoreKey === "medium" || score >= 60
      ? "bg-yellow-500/80 text-white"
      : "bg-red-500/80 text-white";

  const metrics = [
    { label: "Hook", value: breakdown.hook, color: "bg-emerald-400" },
    { label: "Retention", value: breakdown.retention, color: "bg-purple-400" },
    { label: "Emotional", value: breakdown.emotional, color: "bg-pink-400" },
    { label: "Trending", value: breakdown.trending, color: "bg-amber-400" },
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-label={`Score: ${score}. Click or focus for breakdown.`}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand ${badgeColor}`}
      >
        Score: {score}
      </div>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-2 w-52 p-3 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-white text-xs space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-semibold text-white/90">
            <span>Quality Score</span>
            <span className="text-brand font-bold">{score}/100</span>
          </div>

          <div className="space-y-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-white/70 font-medium">
                  <span>{metric.label}</span>
                  <span className="text-white/90 font-mono">{metric.value}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${metric.color}`}
                    style={{ width: `${Math.min(100, Math.max(0, metric.value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
