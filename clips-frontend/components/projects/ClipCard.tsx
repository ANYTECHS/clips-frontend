"use client";

import React, { useState, memo } from "react";
import { 
  Play, 
  Download, 
  Edit, 
  Check 
} from "lucide-react";

interface ClipCardProps {
  id: string;
  title: string;
  thumbnail: string;
  score: number;
  duration: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const ClipCard = memo(function ClipCard({ 
  id, 
  title, 
  thumbnail, 
  score, 
  duration, 
  isSelected, 
  onSelect 
}: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getScoreStyle = (s: number) => {
    if (s >= 90) return "bg-[#00E58F] border-[#00E58F] text-black shadow-[0_0_20px_rgba(0,229,143,0.4)]";
    if (s >= 70) return "bg-[#FACC15] border-[#FACC15] text-black shadow-[0_0_20px_rgba(250,204,21,0.4)]";
    return "bg-[#EF4444] border-[#EF4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]";
  };

  return (
    <div 
      className={`group relative bg-[#0B100E] border rounded-[24px] sm:rounded-[32px] overflow-hidden transition-all duration-500 ${
        isSelected 
          ? "border-brand ring-1 ring-brand/20 shadow-[0_0_50px_rgba(0,229,143,0.15)]" 
          : "border-white/5 hover:border-white/20"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-video overflow-hidden group/thumb">
        <img 
          src={thumbnail} 
          alt={title} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Selection Indicator (Top Left) — always visible on touch, hover on desktop */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          className={`absolute top-3 left-3 sm:top-4 sm:left-4 w-8 h-8 sm:w-6 sm:h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer z-20 touch-manipulation ${
            isSelected 
              ? "bg-brand border-brand shadow-[0_0_15px_rgba(0,229,143,0.4)]" 
              : "bg-black/40 border-white/20 hover:border-white/40 backdrop-blur-md"
          }`}
        >
          {isSelected && <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-black stroke-[4px]" />}
        </div>

        {/* Score Badge (Top Right) */}
        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-lg backdrop-blur-md border z-20 transition-all ${getScoreStyle(score)}`}>
          <span className="text-[10px] font-black tracking-widest leading-none">AI SCORE {score}%</span>
        </div>

        {/* Play Overlay — visible on hover (desktop) or always on touch */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300 z-10 ${
          isHovered ? "opacity-100" : "opacity-0 [@media(hover:none)]:opacity-100"
        }`}>
          <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
             <Play className="w-6 h-6 sm:w-5 sm:h-5 text-white fill-white ml-1" />
          </div>
        </div>

        {/* Duration (Bottom Right) */}
        <div className="absolute bottom-3 right-3 sm:right-4 px-1.5 py-0.5 rounded-md bg-black/80 text-[10px] font-black text-white z-20">
          {duration}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="space-y-1.5">
          <h4 className="text-[14px] font-bold text-white tracking-tight leading-tight">
            {title}
          </h4>
          <p className="text-[11px] font-medium text-[#5A6F65]">
            Perfect for TikTok & Reels
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 text-[#5A6F65] hover:text-white transition-colors touch-manipulation" title="Edit">
              <Edit className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#5A6F65] hover:text-white transition-colors touch-manipulation" title="Download">
              <Download className="w-4 h-4" />
            </button>
          </div>
          <button className="text-[11px] font-black text-brand uppercase tracking-widest flex items-center gap-1.5 hover:underline py-1.5 touch-manipulation">
            PREVIEW <span className="text-[14px] leading-none mb-0.5">›</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default ClipCard;
