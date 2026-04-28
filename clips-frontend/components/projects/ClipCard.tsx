"use client";

import React, { useState, memo, useCallback } from "react";
import { 
  Play, 
  Download, 
  Edit, 
  Check,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

interface ClipCardProps {
  id: string;
  title: string;
  thumbnail: string;
  score: number;
  duration: string;
  isSelected: boolean;
  isRecommended?: boolean;
  onSelect: (id: string) => void;
  /** Optional callback invoked when the user clicks Edit. */
  onEdit?: (id: string) => void;
  /** Optional callback invoked when the user clicks Download. */
  onDownload?: (id: string) => void;
}

function useToast() {
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" } | null>(null);
  const show = useCallback((message: string, type: "info" | "success" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

const ClipCard = memo(function ClipCard({ 
  id, 
  title, 
  thumbnail, 
  score, 
  duration, 
  isSelected,
  isRecommended = false,
  onSelect,
  onEdit,
  onDownload,
}: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { toast, show: showToast } = useToast();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(id);
    } else {
      showToast("Clip editor coming soon", "info");
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(id);
    } else {
      // Fallback: open thumbnail in new tab as stand-in until real clip URL is available
      const a = document.createElement("a");
      a.href = thumbnail;
      a.download = `${title.replace(/\s+/g, "_")}.mp4`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    showToast("Download started", "success");
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast("Preview coming soon", "info");
  };

  const getScoreStyle = (s: number) => {
    if (s >= 90) return "bg-brand border-brand text-black shadow-[0_0_20px_rgba(0,229,143,0.4)]";
    if (s >= 70) return "bg-warning border-warning text-black shadow-[0_0_20px_rgba(250,204,21,0.4)]";
    return "bg-error border-error text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]";
  };

  return (
    <div 
      className={`group relative bg-input border rounded-[24px] sm:rounded-[32px] overflow-hidden transition-all duration-500 ${
        isSelected 
          ? "border-brand ring-1 ring-brand/20 shadow-[0_0_50px_rgba(0,229,143,0.15)]"
          : isRecommended
          ? "border-brand/40 ring-1 ring-brand/10 shadow-[0_0_30px_rgba(0,229,143,0.08)]"
          : "border-white/5 hover:border-white/20"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Recommended ribbon */}
      {isRecommended && !isSelected && (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-1.5 px-4 py-1.5 bg-brand/10 border-b border-brand/20">
          <Sparkles className="w-3 h-3 text-brand shrink-0" aria-hidden="true" />
          <span className="text-[10px] font-black text-brand uppercase tracking-widest">AI Recommended</span>
        </div>
      )}
      {/* Thumbnail Area */}
      <div className={`relative aspect-video overflow-hidden group/thumb ${isRecommended && !isSelected ? "mt-[28px]" : ""}`}>
        <img 
          src={thumbnail} 
          alt={title} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Selection Indicator (Top Left) — always visible on touch, hover on desktop */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onSelect(id);
            }
          }}
          aria-label={`Select clip: ${title}`}
          aria-pressed={isSelected}
          className={`absolute top-3 left-3 sm:top-4 sm:left-4 w-8 h-8 sm:w-6 sm:h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer z-20 touch-manipulation ${
            isSelected 
              ? "bg-brand border-brand shadow-[0_0_15px_rgba(0,229,143,0.4)]" 
              : "bg-black/40 border-white/20 hover:border-white/40 backdrop-blur-md"
          }`}
        >
          {isSelected && <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-black stroke-[4px]" />}
        </button>

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
          <p className="text-[11px] font-medium text-muted-foreground">
            Perfect for TikTok & Reels
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Edit clip"
              onClick={handleEdit}
              className="p-1.5 text-muted-foreground hover:text-white transition-colors touch-manipulation"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              aria-label="Download clip"
              onClick={handleDownload}
              className="p-1.5 text-muted-foreground hover:text-white transition-colors touch-manipulation"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <button
            aria-label="Preview clip"
            onClick={handlePreview}
            className="text-[11px] font-black text-brand uppercase tracking-widest flex items-center gap-1.5 hover:underline py-1.5 touch-manipulation"
          >
            PREVIEW <span className="text-[14px] leading-none mb-0.5">›</span>
          </button>
        </div>
      </div>

      {/* In-card toast */}
      {toast && (
        <div className="absolute bottom-4 left-4 right-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-md ${
            toast.type === "success"
              ? "bg-brand/10 border-brand/30 text-brand"
              : "bg-[#0C120F]/90 border-white/10 text-white"
          }`}>
            {toast.type === "success"
              ? <Check className="w-3.5 h-3.5 shrink-0" />
              : <Zap className="w-3.5 h-3.5 shrink-0 text-brand" />
            }
            <p className="text-[12px] font-semibold">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ClipCard;
