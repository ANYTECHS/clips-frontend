"use client";

import React from "react";
import Link from "next/link";
import { 
  Filter, 
  Sparkles, 
  Layout, 
  Type, 
  Check, 
  Clock, 
  ChevronDown,
  ArrowLeft
} from "lucide-react";

interface ProjectFiltersProps {
  captionsStyle: string;
  onCaptionsStyleChange: (style: string) => void;
  viralityLevels: string[];
  onViralityLevelToggle: (level: string) => void;
  activeFilterCount: number;
  onResetFilters: () => void;
  mobile?: boolean;
}

export default function ProjectFilters({
  captionsStyle,
  onCaptionsStyleChange,
  viralityLevels,
  onViralityLevelToggle,
  activeFilterCount,
  onResetFilters,
  mobile = false,
}: ProjectFiltersProps) {
  const captionsStyles = ["All Styles", "Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];
  const levels = [
    { label: "High (80-100)", key: "high", count: 12 },
    { label: "Medium (50-79)", key: "medium", count: 42 },
    { label: "Low (<50)", key: "low", count: 8 },
  ];

  return (
    <div className={`w-[300px] pr-6 border-r border-white/5 h-full flex-col animate-in fade-in slide-in-from-left duration-700 ${mobile ? "flex" : "hidden xl:flex"}`}>
      <div className="flex-1 overflow-y-auto pr-4 space-y-10 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 transition-all custom-sidebar-scroll pb-10">
        {/* Branding Section */}
        <div className="space-y-6 pt-2">
          <Link href="/dashboard" className="flex items-center gap-3 text-[20px] font-extrabold tracking-tight text-white group">
            <div className="w-[32px] h-[32px] bg-brand rounded-[10px] flex items-center justify-center text-black text-[18px] group-hover:scale-110 transition-transform">
              ⚡
            </div>
            <span>ClipCash <span className="text-brand">AI</span></span>
          </Link>

          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#5A6F65] hover:text-white transition-colors group">
            <div className="w-8 h-8 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:bg-brand/10 group-hover:border-brand/20 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back to Dashboard
          </Link>
        </div>

        {/* Curation Tools Section */}
        <div className="space-y-6">
          <h3 className="text-[11px] font-black text-[#5A6F65] uppercase tracking-[0.2em] mb-4">Curation Tools</h3>
          
          <div className="space-y-2">
            <button 
              onClick={onResetFilters}
              className={`w-full group flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                activeFilterCount > 0 
                  ? "bg-brand/10 border border-brand/40 text-brand" 
                  : "bg-[#111815] border border-white/5 text-[#5A6F65] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 font-bold text-[13px]">
                <Filter className="w-4 h-4" />
                <span>{activeFilterCount > 0 ? "Clear Filters" : "Active Filters"}</span>
              </div>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                activeFilterCount > 0 ? "bg-brand text-black" : "bg-white/5 text-[#5A6F65]"
              }`}>
                {activeFilterCount}
              </div>
            </button>

            <button className="w-full group flex items-center gap-3 px-4 py-3 text-[#5A6F65] hover:text-white transition-all rounded-2xl hover:bg-white/[0.03]">
              <Sparkles className="w-4 h-4" />
              <span className="text-[13px] font-bold">AI Suggestions</span>
            </button>

            <div className="space-y-3 pt-2">
              <label className="text-[11px] font-bold text-[#3A4A43] flex items-center gap-2 uppercase tracking-widest pl-4">
                <Type className="w-3 h-3" />
                Captions Style
              </label>
              <div className="px-4">
                <div className="relative group">
                  <select 
                    value={captionsStyle}
                    onChange={(e) => onCaptionsStyleChange(e.target.value)}
                    className="w-full bg-[#0B100E] border border-white/5 rounded-xl px-4 py-3 text-[12px] font-bold text-gray-300 outline-none appearance-none cursor-pointer focus:border-brand/40 transition-all"
                  >
                    {captionsStyles.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A6F65] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Virality Score Section */}
        <div className="space-y-6">
          <h3 className="text-[11px] font-black text-[#5A6F65] uppercase tracking-[0.2em] mb-4">Virality Score</h3>
          
          <div className="space-y-4 px-1">
            {levels.map((level) => {
              const isActive = viralityLevels.includes(level.key);
              return (
                <div 
                  key={level.key} 
                  onClick={() => onViralityLevelToggle(level.key)}
                  className="flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                      isActive 
                        ? "bg-brand border-brand shadow-[0_0_10px_rgba(0,229,143,0.3)]" 
                        : "border-white/10 bg-white/5 opacity-40 hover:opacity-100"
                    }`}>
                      {isActive && <Check className="w-3.5 h-3.5 text-black stroke-[3px]" />}
                    </div>
                    <span className={`text-[13px] font-bold transition-colors ${
                      isActive ? "text-white" : "text-[#5A6F65]"
                    }`}>
                      {level.label}
                    </span>
                  </div>
                  <span className={`text-[11px] font-black ${
                    isActive ? "text-brand" : "text-[#3A4A43]"
                  }`}>{level.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini Pro Plan Card */}
        <div className="bg-[#0B100E] border border-white/5 rounded-[32px] p-6 space-y-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full -bottom-1/2 -right-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="space-y-2 relative z-10">
            <p className="text-[11px] font-black text-brand uppercase tracking-[0.2em]">PRO PLAN</p>
            <p className="text-[13px] font-medium text-[#5A6F65]">You have <span className="text-white">12.4GB</span> storage left.</p>
          </div>
          <button className="w-full py-3 bg-brand text-black font-black text-[13px] rounded-2xl tracking-tight transition-all active:scale-[0.98] relative z-10 hover:shadow-[0_0_20px_rgba(0,229,143,0.3)]">
            Upgrade Now
          </button>
        </div>
      </div>

      <style jsx>{`
        .custom-sidebar-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-sidebar-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
