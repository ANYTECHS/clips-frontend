"use client";

import React, { useRef, useEffect } from "react";
import Image from "next/image";
import { Check, Edit2, Play, Sparkles, BarChart3 } from "lucide-react";
import ScoreBreakdownTooltip, { ScoreBreakdown } from "./ScoreBreakdownTooltip";
import ExportDropdown from "./ExportDropdown";

export interface Clip {
  id: string;
  title: string;
  thumbnail: string;
  score: number;
  scoreKey: string;
  duration: string;
  style: string;
  status: string;
  resolution: string;
  videoUrl: string;
  scoreBreakdown?: ScoreBreakdown;
  tags?: string[];
}

export interface ClipGridProps {
  clips: Clip[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onSelectByScore: (minScore: number) => void;
  aiRecommendations: boolean;
  recommendedIds: string[];
  recommendationThreshold: number;
  onToggleRecommendations: () => void;
  onAutoSelect: () => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  loading: boolean;
  totalClips: number;
  loadingNextPage: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  userPlan?: "free" | "pro" | "enterprise";
}

export default function ClipGrid({
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
  loading,
  totalClips,
  loadingNextPage,
  onLoadMore,
  hasMore,
  userPlan = "free",
}: ClipGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loadingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onLoadMore(); },
      { rootMargin: "100px" }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingNextPage, onLoadMore]);

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="animate-pulse bg-white/5 rounded-2xl aspect-[9/16] w-full" />
        ))}
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No clips found</h3>
        <p className="text-muted-foreground max-w-sm">
          Try adjusting your filters or upload new videos to generate more clips.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <button onClick={selectedIds.length === clips.length ? onSelectNone : onSelectAll} className="text-sm font-medium text-white hover:text-brand transition-colors">
            {selectedIds.length === clips.length ? "Deselect All" : "Select All"}
          </button>
          <span className="text-white/20">|</span>
          <span className="text-sm text-muted-foreground">{selectedIds.length} of {totalClips} selected</span>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onToggleRecommendations} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${aiRecommendations ? "bg-brand/20 text-brand" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
            <Sparkles className="w-4 h-4" /> AI Recommendations
          </button>
          {aiRecommendations && <button onClick={onAutoSelect} className="text-sm font-medium text-brand hover:text-brand-hover">Select Top Clips</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {clips.map((clip) => {
          const isSelected = selectedIds.includes(clip.id);
          const isRecommended = aiRecommendations && clip.score >= recommendationThreshold;

          return (
            <div key={clip.id} className={`group relative rounded-2xl overflow-hidden transition-all duration-300 border-2 ${isSelected ? "border-brand shadow-[0_0_20px_rgba(var(--brand),0.3)]" : "border-transparent hover:border-white/20"}`}>
              <div className="aspect-[9/16] w-full bg-black relative cursor-pointer" onClick={() => onSelect(clip.id)} role="checkbox" aria-checked={isSelected} tabIndex={0} onKeyDown={(e) => handleKeyDown(e, clip.id)}>
                <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10" onClick={(e) => e.stopPropagation()}>
                  <ScoreBreakdownTooltip score={clip.score} scoreKey={clip.scoreKey} scoreBreakdown={clip.scoreBreakdown} />
                  {isRecommended && <div className="bg-brand text-black px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-lg animate-pulse"><Sparkles className="w-3 h-3" /> Top Pick</div>}
                </div>
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-brand border-brand" : "border-white/50 bg-black/50 group-hover:border-white"} ${isRecommended ? "top-10" : ""}`}>
                  {isSelected && <Check className="w-4 h-4 text-black" />}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="text-white font-bold text-sm mb-1 line-clamp-2">{clip.title}</h4>
                  <div className="flex items-center gap-2 text-xs text-white/70 mb-2"><span>{clip.duration}</span><span>•</span><span>{clip.resolution}</span></div>
                  {clip.tags && clip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {clip.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="inline-block px-2 py-0.5 bg-brand/20 text-brand text-xs rounded-md font-semibold border border-brand/30 truncate max-w-[calc(50%-2px)]">
                          {tag}
                        </span>
                      ))}
                      {clip.tags.length > 2 && <span className="inline-block px-2 py-0.5 bg-white/10 text-white/60 text-xs rounded-md font-semibold border border-white/20">+{clip.tags.length - 2}</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/90 translate-y-full group-hover:translate-y-0 transition-transform flex items-center-stretch gap-2 backdrop-blur-md">
                <button onClick={(e) => { e.stopPropagation(); onPreview(clip.id); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors" aria-label="Preview clip"><Play className="w-4 h-4" /> Preview</button>
                <button onClick={(e) => { e.stopPropagation(); onEdit(clip.id); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors" aria-label="Edit clip"><Edit2 className="w-4 h-4" /> Edit</button>
                <ExportDropdown clipId={clip.id} userPlan={userPlan} />
                <a href={`/analytics?clipId=${clip.id}`} onClick={(e) => e.stopPropagation()} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors" aria-label="View analytics"><BarChart3 className="w-4 h-4" /> Analytics</a>
              </div>
            </div>
          );
        })}
      </div>

      {(hasMore || loadingNextPage) && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {loadingNextPage ? <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" /> : <div className="w-8 h-8" />}
        </div>
      )}
    </div>
  );
}