"use client";

import React, { memo } from "react";
import ClipCard from "./ClipCard";
import ProjectCardSkeleton from "./ProjectCardSkeleton";
import AIRecommendationBanner from "./AIRecommendationBanner";
import { ListFilter, ChevronDown } from "lucide-react";

interface Clip {
  id: string;
  title: string;
  thumbnail: string;
  score: number;
  duration: string;
}

interface ClipGridProps {
  clips: Clip[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone?: () => void;
  onSelectByScore?: (minScore: number) => void;
  // AI recommendations
  aiRecommendations: boolean;
  recommendedIds: string[];
  recommendationThreshold: number;
  onToggleRecommendations: () => void;
  onAutoSelect: () => void;
  onEdit?: (id: string) => void;
  onPreview?: (id: string) => void;
  loading?: boolean;
}

const ClipGrid = memo(function ClipGrid({ 
  clips, 
  selectedIds, 
  onSelect, 
  onSelectAll,
  onSelectNone,
  onSelectByScore,
  aiRecommendations,
  recommendedIds,
  recommendationThreshold,
  onToggleRecommendations,
  onAutoSelect,
  onEdit,
  onPreview,
  loading = false,
}: ClipGridProps) {
  const [scoreFilter, setScoreFilter] = React.useState(80);
  const allSelected = !loading && clips.length > 0 && selectedIds.length === clips.length;

  return (
    <div 
      className="flex-1 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700"
      aria-busy={loading}
    >
      {/* Grid Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[24px] sm:text-[32px] lg:text-[36px] font-black text-white tracking-tight leading-none">
              {loading ? "AI is finding clips..." : `AI found ${clips.length} clips`}
            </h2>
            <div className="px-2.5 py-1 rounded-md bg-brand/10 border border-brand/20 text-brand text-[10px] font-black tracking-widest leading-none shrink-0">
              ACTIVE
            </div>
          </div>
          <p className="text-[13px] sm:text-[14px] font-medium text-muted-foreground truncate">
            {loading ? "Analyzing your video content..." : (
              <>
                Automatically curated from{" "}
                <span className="text-white">"Q3 Keynote - Product Launch.mp4"</span>
              </>
            )}
          </p>
        </div>

        {!loading && (
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onSelectAll}
              className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[13px] sm:text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98] touch-manipulation"
            >
              <span>{allSelected ? "Deselect All" : "Select All"}</span>
            </button>

            {selectedIds.length > 0 && onSelectNone && (
              <button
                onClick={onSelectNone}
                className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-black border border-white/10 text-muted-foreground font-black text-[13px] sm:text-[14px] transition-all hover:bg-zinc-900 hover:text-white active:scale-[0.98] touch-manipulation"
              >
                <span>Select None</span>
              </button>
            )}

            {onSelectByScore && (
              <div className="flex items-center gap-2 bg-black border border-white/10 rounded-xl px-3 py-2">
                <ListFilter className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[12px] text-muted-foreground hidden sm:inline whitespace-nowrap">Score ≥</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(Number(e.target.value))}
                  className="w-12 bg-transparent text-white text-[13px] font-black outline-none text-center"
                  aria-label="Minimum virality score"
                />
                <button
                  onClick={() => onSelectByScore(scoreFilter)}
                  className="text-brand text-[12px] font-black hover:underline whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
            )}

            <button className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[13px] sm:text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98] touch-manipulation">
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Newest First</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Recommendation Banner */}
      {!loading && (
        <AIRecommendationBanner
          recommendedCount={recommendedIds.length}
          threshold={recommendationThreshold}
          isActive={aiRecommendations}
          onAutoSelect={onAutoSelect}
          onToggle={onToggleRecommendations}
        />
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 pb-12">
        {loading ? (
          // Render 6 skeletons during loading
          Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={`skeleton-${i}`} />
          ))
        ) : (
          clips.map((clip) => (
            <ClipCard 
              key={clip.id}
              {...clip}
              isSelected={selectedIds.includes(clip.id)}
              isRecommended={aiRecommendations && recommendedIds.includes(clip.id)}
              onSelect={onSelect}
              onEdit={onEdit}
              onPreview={onPreview}
            />
          ))
        )}
      </div>
    </div>
  );
});


export default ClipGrid;
