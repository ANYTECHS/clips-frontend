"use client";

import { SlidersHorizontal } from "lucide-react";
import React from "react";

import { RANKING_CRITERIA, type RankingWeights } from "@/app/lib/clipRanking";
import {
  RANKING_PRESET_IDS,
  RANKING_WEIGHT_PRESETS,
  type RankingPreferences,
  type RankingPresetId,
} from "@/app/lib/userPreferences";

import { RANKING_CRITERION_LABELS } from "./RankExplanationTooltip";

export interface RankingWeightsPanelProps {
  weights: RankingWeights;
  preset: RankingPreferences["preset"];
  onWeightsChange: (weights: Partial<RankingWeights>) => void;
  onPresetChange: (presetId: RankingPresetId) => void;
}

/**
 * Lets creators tune how clips are ranked: pick a preset or adjust each
 * criterion's weight. Changes are persisted by `useClipRanking`.
 */
export function RankingWeightsPanel({
  weights,
  preset,
  onWeightsChange,
  onPresetChange,
}: RankingWeightsPanelProps) {
  return (
    <details className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-white/90 select-none">
        <SlidersHorizontal className="w-4 h-4 text-brand" />
        Ranking weights
        <span className="text-xs text-muted-foreground">
          ({preset === "custom" ? "Custom" : RANKING_WEIGHT_PRESETS[preset].label})
        </span>
      </summary>

      <div className="mt-3 space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider">Preset</span>
          <select
            value={preset}
            onChange={(e) => {
              if (e.target.value !== "custom") onPresetChange(e.target.value as RankingPresetId);
            }}
            className="w-full sm:w-64 rounded-lg border border-white/10 bg-input px-3 py-2 text-white"
          >
            {RANKING_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {RANKING_WEIGHT_PRESETS[id].label} — {RANKING_WEIGHT_PRESETS[id].description}
              </option>
            ))}
            {preset === "custom" && <option value="custom">Custom</option>}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RANKING_CRITERIA.map((criterion) => (
            <label key={criterion} className="flex flex-col gap-1">
              <span className="flex justify-between text-xs font-medium">
                <span>{RANKING_CRITERION_LABELS[criterion]}</span>
                <span className="font-mono text-white/90">{Math.round(weights[criterion] * 100)}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[criterion]}
                onChange={(e) => onWeightsChange({ [criterion]: Number(e.target.value) })}
                aria-label={`${RANKING_CRITERION_LABELS[criterion]} weight`}
                className="w-full accent-brand"
              />
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
