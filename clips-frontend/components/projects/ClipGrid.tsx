"use client";

import React from "react";
import ClipCard from "./ClipCard";
import { ListFilter, ChevronDown, CheckSquare, Square } from "lucide-react";

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
}

export default function ClipGrid({ 
  clips, 
  selectedIds, 
  onSelect, 
  onSelectAll 
}: ClipGridProps) {
  const allSelected = selectedIds.length === clips.length && clips.length > 0;

  return (
    <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Grid Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
             <h2 className="text-[24px] sm:text-[32px] lg:text-[36px] font-black text-white tracking-tight leading-none">AI found {clips.length} clips</h2>
             <div className="px-2.5 py-1 rounded-md bg-[#00E58F]/10 border border-[#00E58F]/20 text-[#00E58F] text-[10px] font-black tracking-widest leading-none shrink-0">ACTIVE</div>
          </div>
          <p className="text-[13px] sm:text-[14px] font-medium text-[#5A6F65] truncate">
            Automatically curated from <span className="text-white">"Q3 Keynote - Product Launch.mp4"</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={onSelectAll}
            className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[13px] sm:text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98] touch-manipulation"
          >
            <span>Select All</span>
          </button>

          <button className="flex items-center gap-2 px-4 sm:px-6 py-3 rounded-xl bg-black border border-white/10 text-white font-black text-[13px] sm:text-[14px] transition-all hover:bg-zinc-900 active:scale-[0.98] touch-manipulation">
            <ListFilter className="w-4 h-4 text-[#5A6F65]" />
            <span className="hidden sm:inline">Newest First</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5A6F65]" />
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 pb-12">
        {clips.map((clip) => (
          <ClipCard 
            key={clip.id}
            {...clip}
            isSelected={selectedIds.includes(clip.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
