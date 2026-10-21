"use client";

import { Info } from "lucide-react";
import React, { useId, useState } from "react";

import type { ClipRankingDetails, RankingCriterion } from "@/app/lib/clipRanking";
import { RANKING_CRITERIA } from "@/app/lib/clipRanking";

export const RANKING_CRITERION_LABELS: Record<RankingCriterion, string> = {
  virality: "Virality",
  duration: "Duration fit",
  captionQuality: "Caption quality",
  engagement: "Engagement",
};

export interface RankExplanationTooltipProps {
  details: ClipRankingDetails;
  totalClips: number;
  className?: string;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * "Why this rank?" — shows the normalised (0–1) score for each ranking
 * criterion and how much it contributed to the clip's weighted rank score.
 */
export function RankExplanationTooltip({
  details,
  totalClips,
  className = "",
}: RankExplanationTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 text-[11px] font-semibold text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <Info className="w-3 h-3" />
        #{details.rank} · Why this rank?
      </button>

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 left-0 bottom-full mb-2 w-56 p-3 bg-gray-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md text-white text-xs space-y-2 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-semibold text-white/90">
            <span>
              Rank {details.rank} of {totalClips}
            </span>
            <span className="text-brand font-bold">{percent(details.rankScore)}</span>
          </div>

          <div className="space-y-2">
            {RANKING_CRITERIA.map((criterion) => (
              <div key={criterion} className="space-y-0.5">
                <div className="flex justify-between text-[11px] text-white/70 font-medium">
                  <span>{RANKING_CRITERION_LABELS[criterion]}</span>
                  <span className="text-white/90 font-mono">
                    {percent(details.components[criterion])}
                    <span className="text-white/50"> (+{percent(details.contributions[criterion])})</span>
                  </span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand transition-all duration-300"
                    style={{ width: percent(details.components[criterion]) }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/50">
            Scores are normalised to 0–100% before your ranking weights are applied.
          </p>
        </div>
      )}
    </div>
  );
}
