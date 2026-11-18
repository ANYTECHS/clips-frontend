"use client";

import React from "react";
import ClipCard from "./ClipCard";
import { ListFilter, ChevronDown } from "lucide-react";
import { ReadyToPostKit } from "@/lib/queries";

interface Clip {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  readyToPostKit?: ReadyToPostKit | null;
}

interface ClipGridProps {
  clips: Clip[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onDelete?: (id: string) => Promise<void>;
}

export default function ClipGrid({
  clips,
  selectedIds,
  onSelect,
  onSelectAll,
  onDelete,
}: ClipGridProps) {
  if (clips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center space-y-4">
        <p className="text-[#90A89C] text-[16px] font-medium">No clips yet.</p>
        <p className="text-[#5A7A6B] text-[13px]">Upload a video to start generating clips.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#0e4d2a]">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-[28px] sm:text-[36px] font-black text-[#F4F7EF] tracking-tight leading-none">
              {clips.length} clip{clips.length !== 1 ? "s" : ""}
            </h2>
            <div className="px-2.5 py-0.5 rounded-md bg-[#B6FF4A]/12 border border-[#B6FF4A]/25 text-[#B6FF4A] text-[9px] sm:text-[10px] font-black tracking-widest leading-none">
              READY
            </div>
          </div>
          <p className="text-[13px] sm:text-[14px] font-medium text-[#90A89C]">
            AI-generated clips ready to preview and post
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] font-bold text-[13px] sm:text-[14px] transition-all hover:bg-[#084223] active:scale-[0.98]"
          >
            {selectedIds.length === clips.length ? "Deselect All" : "Select All"}
          </button>
          <button className="hidden sm:flex items-center gap-2 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] font-bold text-[13px] sm:text-[14px] transition-all hover:bg-[#084223] hover:border-[#39FF14]/40 active:scale-[0.98]">
            <ListFilter className="w-4 h-4 text-[#90A89C]" />
            <span>Newest First</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#90A89C]" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            {...clip}
            isSelected={selectedIds.includes(clip.id)}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
