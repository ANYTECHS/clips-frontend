"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, TrendingUp, Clock, Zap, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import AIClipCard from "./AIClipCard";
import { ReadyToPostKit } from "@/lib/queries";

interface Clip {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  platform: string;
  createdAt: string | null;
  creatorAddress?: string;
  creatorName?: string;
  tippingEnabled?: boolean;
  readyToPostKit?: ReadyToPostKit | null;
}

interface AIProjectsContentProps {
  clips: Clip[];
  total?: number;
  currentPage?: number;
  totalPages?: number;
  limit?: number;
  isFetching?: boolean;
  onPageChange?: (newPage: number) => void;
}

const SORT_OPTIONS = [
  { key: "score", label: "Viral Score", icon: TrendingUp },
  { key: "newest", label: "Newest", icon: Clock },
  { key: "duration", label: "Duration", icon: Zap },
];

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);
  return pages;
}

export default function AIProjectsContent({
  clips,
  total,
  currentPage = 1,
  totalPages = 1,
  limit = 20,
  isFetching = false,
  onPageChange,
}: AIProjectsContentProps) {
  const [sort, setSort] = useState("score");
  const [searchQuery, setSearchQuery] = useState("");

  const totalClipsCount = typeof total === "number" ? total : clips.length;

  const filtered = useMemo(() => {
    let result = [...clips];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.creatorName?.toLowerCase().includes(q) ||
          c.platform?.toLowerCase().includes(q)
      );
    }

    if (sort === "score") {
      result.sort((a, b) => b.score - a.score);
    } else if (sort === "newest") {
      result.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (sort === "duration") {
      result.sort((a, b) => {
        const toSeconds = (d: string) => {
          const parts = d.split(":").map(Number);
          return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
        };
        return toSeconds(b.duration) - toSeconds(a.duration);
      });
    }

    return result;
  }, [clips, sort, searchQuery]);

  const highCount = clips.filter((c) => c.scoreKey === "HIGH").length;
  const avgScore = clips.length > 0
    ? Math.round(clips.reduce((acc, c) => acc + (c.score || 0), 0) / clips.length)
    : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-10 max-w-[1400px] mx-auto w-full space-y-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/25 text-[#B6FF4A] text-[11px] font-black tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Public Feed
          </div>
         
          <p className="text-[#90A89C] text-[15px] font-medium max-w-lg leading-relaxed">
            Discover viral clips from creators around the world. Browse, preview, and tip to download.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-[#F4F7EF] leading-none">{totalClipsCount}</p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">Total Clips</p>
          </div>
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-[#B6FF4A] leading-none">{highCount}</p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">High Viral</p>
          </div>
          <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl px-5 py-3 text-center">
            <p className="text-[28px] font-black text-[#F4F7EF] leading-none">{avgScore}</p>
            <p className="text-[10px] font-bold text-[#90A89C] uppercase tracking-widest mt-1">Avg Score</p>
          </div>
        </div>
      </div>

      {/* ── Controls & Quick Pagination ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Sort */}
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search box */}
          <div className="relative flex-1 sm:flex-initial sm:min-w-[280px]">
            <Search className="w-4 h-4 text-[#90A89C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clips, creators, platforms..."
              className="w-full bg-[#06351C] border border-[#0e4d2a] focus:border-[#39FF14]/50 text-[#F4F7EF] placeholder-[#90A89C] text-[12px] font-medium rounded-xl pl-9 pr-8 py-2.5 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#90A89C] hover:text-[#F4F7EF]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort options */}
          <div className="flex items-center gap-2">
            {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
                  sort === key
                    ? "bg-[#B6FF4A] text-[#020D08] font-black shadow-[0_0_15px_rgba(57,255,20,0.25)]"
                    : "bg-[#06351C] border border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF] hover:border-[#39FF14]/40"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Top Quick Navigation Buttons */}
        {onPageChange && (
          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            <span className="text-[12px] text-[#90A89C] font-semibold">
              Page <span className="text-[#F4F7EF] font-bold">{currentPage}</span> of{" "}
              <span className="text-[#F4F7EF] font-bold">{totalPages}</span>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isFetching}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] text-[12px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4 text-[#B6FF4A]" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isFetching}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] text-[12px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 text-[#B6FF4A]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Clips Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          totalClips={clips.length}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery("")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((clip) => (
            <AIClipCard key={clip.id} {...clip} />
          ))}
        </div>
      )}

      {/* ── Bottom Full Pagination Controls ── */}
      {onPageChange && totalPages > 1 && (
        <div className="pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#0e4d2a]">
          <p className="text-[13px] text-[#90A89C] font-medium">
            Showing clips{" "}
            <span className="text-[#F4F7EF] font-bold">
              {(currentPage - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="text-[#F4F7EF] font-bold">
              {Math.min(currentPage * limit, totalClipsCount)}
            </span>{" "}
            of{" "}
            <span className="text-[#F4F7EF] font-bold">{totalClipsCount}</span>
          </p>

          <div className="flex items-center gap-2">
            {/* Previous */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isFetching}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] text-[12px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-[#B6FF4A]" />
              <span>Previous</span>
            </button>

            {/* Page number buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                typeof p === "number" ? (
                  <button
                    key={idx}
                    onClick={() => onPageChange(p)}
                    disabled={isFetching}
                    className={`w-9 h-9 rounded-xl text-[12px] font-bold transition-all ${
                      p === currentPage
                        ? "bg-[#B6FF4A] text-[#020D08] font-black shadow-[0_0_15px_rgba(57,255,20,0.25)]"
                        : "bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#90A89C] hover:text-[#F4F7EF]"
                    }`}
                  >
                    {p}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-[#90A89C] text-[12px] font-bold select-none">
                    {p}
                  </span>
                )
              )}
            </div>

            {/* Mobile current indicator */}
            <span className="sm:hidden text-[12px] text-[#90A89C] font-bold px-2">
              {currentPage} / {totalPages}
            </span>

            {/* Next */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isFetching}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#06351C] border border-[#0e4d2a] hover:border-[#39FF14]/40 text-[#F4F7EF] text-[12px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              aria-label="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4 text-[#B6FF4A]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  totalClips,
  searchQuery,
  onClearSearch,
}: {
  totalClips: number;
  searchQuery?: string;
  onClearSearch?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="w-20 h-20 rounded-[28px] bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 flex items-center justify-center mb-2">
        <Sparkles className="w-9 h-9 text-[#B6FF4A]" />
      </div>
      {searchQuery ? (
        <>
          <p className="text-[#F4F7EF] text-[18px] font-extrabold">No clips found</p>
          <p className="text-[#90A89C] text-[14px] font-medium max-w-xs leading-relaxed">
            No clips match &ldquo;{searchQuery}&rdquo;. Try another search term or clear the filter.
          </p>
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="px-4 py-2 rounded-xl bg-[#B6FF4A] text-[#020D08] font-black text-xs hover:bg-[#c6ff6b] transition-opacity"
            >
              Clear Search
            </button>
          )}
        </>
      ) : totalClips === 0 ? (
        <>
          <p className="text-[#F4F7EF] text-[18px] font-extrabold">No clips in the feed yet</p>
          <p className="text-[#90A89C] text-[14px] font-medium max-w-xs leading-relaxed">
            Check back soon to discover viral clips from creators.
          </p>
        </>
      ) : null}
    </div>
  );
}
