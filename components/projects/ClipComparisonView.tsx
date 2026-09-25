"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Star,
  Trophy,
  Download,
  Filter,
  ArrowUpDown,
  X,
  FileText,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import type { Clip } from "./ClipGrid";
import {
  type ClipEvaluation,
  calculateWeightedScore,
  generateComparisonCSV,
  generateComparisonMarkdown,
  generateComparisonJSON,
} from "@/app/lib/comparisonReport";
import { useI18n } from "@/app/lib/i18n/I18nProvider";
import { sanitize } from "@/app/lib/sanitize";

export interface ClipComparisonViewProps {
  clips: Clip[];
  onClose: () => void;
  onSelectWinner?: (clipId: string) => void;
}

export default function ClipComparisonView({
  clips,
  onClose,
  onSelectWinner,
}: ClipComparisonViewProps) {
  const { t } = useI18n();

  // Guard: Comparison supports 2 to 4 clips
  const validClips = useMemo(() => clips.slice(0, 4), [clips]);

  // Synchronized Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30); // Default fallback duration in seconds
  const [isMuted, setIsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [soloClipId, setSoloClipId] = useState<string | null>(null);

  // References to video elements
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Clip Evaluations & Ratings (key: clipId)
  const [evaluations, setEvaluations] = useState<Record<string, ClipEvaluation>>(() => {
    const initial: Record<string, ClipEvaluation> = {};
    validClips.forEach((c) => {
      initial[c.id] = {
        clipId: c.id,
        rating: 4,
        hookScore: 8,
        visualScore: 8,
        pacingScore: 7,
        isWinner: false,
        notes: "",
      };
    });
    return initial;
  });

  // Filter & Sort State
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [winnerOnlyFilter, setWinnerOnlyFilter] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"default" | "score" | "hook" | "visual">("default");

  // Export State
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Synchronize Playback controls
  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      Object.values(videoRefs.current).forEach((video) => {
        if (!video) return;
        if (next) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
      return next;
    });
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.currentTime = targetTime;
      }
    });
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentTime(0);
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.currentTime = 0;
        if (isPlaying) video.play().catch(() => {});
      }
    });
  }, [isPlaying]);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      Object.values(videoRefs.current).forEach((video) => {
        if (video) video.muted = next;
      });
      return next;
    });
  }, []);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    Object.values(videoRefs.current).forEach((video) => {
      if (video) video.playbackRate = speed;
    });
  }, []);

  const handleSoloAudio = useCallback((clipId: string) => {
    setSoloClipId((prev) => {
      const next = prev === clipId ? null : clipId;
      Object.entries(videoRefs.current).forEach(([id, video]) => {
        if (!video) return;
        if (next === null) {
          video.muted = isMuted;
        } else {
          video.muted = id !== next;
        }
      });
      return next;
    });
  }, [isMuted]);

  // Video time tracking
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration && !isNaN(video.duration) && video.duration > duration) {
      setDuration(video.duration);
    }
    setCurrentTime(video.currentTime);
  };

  // Evaluation Updaters
  const updateEvaluation = useCallback(
    (clipId: string, updates: Partial<ClipEvaluation>) => {
      setEvaluations((prev) => ({
        ...prev,
        [clipId]: {
          ...prev[clipId],
          ...updates,
        },
      }));
    },
    []
  );

  const handleToggleWinner = useCallback(
    (clipId: string) => {
      setEvaluations((prev) => {
        const next = { ...prev };
        const currentlyWinner = prev[clipId]?.isWinner;
        // Only one winner at a time
        Object.keys(next).forEach((id) => {
          next[id] = { ...next[id], isWinner: id === clipId ? !currentlyWinner : false };
        });
        return next;
      });
      if (onSelectWinner) {
        onSelectWinner(clipId);
      }
    },
    [onSelectWinner]
  );

  // Filter & Sort Clips
  const displayedClips = useMemo(() => {
    let list = [...validClips];

    // Filter by rating
    if (minRatingFilter > 0) {
      list = list.filter((c) => (evaluations[c.id]?.rating || 0) >= minRatingFilter);
    }

    // Filter by winner
    if (winnerOnlyFilter) {
      list = list.filter((c) => evaluations[c.id]?.isWinner);
    }

    // Sort
    if (sortBy === "score") {
      list.sort(
        (a, b) =>
          calculateWeightedScore(b.score, evaluations[b.id]) -
          calculateWeightedScore(a.score, evaluations[a.id])
      );
    } else if (sortBy === "hook") {
      list.sort(
        (a, b) => (evaluations[b.id]?.hookScore || 0) - (evaluations[a.id]?.hookScore || 0)
      );
    } else if (sortBy === "visual") {
      list.sort(
        (a, b) => (evaluations[b.id]?.visualScore || 0) - (evaluations[a.id]?.visualScore || 0)
      );
    }

    return list;
  }, [validClips, evaluations, minRatingFilter, winnerOnlyFilter, sortBy]);

  // Export handlers
  const handleExportDownload = (type: "csv" | "md" | "json") => {
    let content = "";
    let mimeType = "";
    let filename = "";

    if (type === "csv") {
      content = generateComparisonCSV(validClips, evaluations);
      mimeType = "text/csv;charset=utf-8;";
      filename = `clip-comparison-${Date.now()}.csv`;
    } else if (type === "md") {
      content = generateComparisonMarkdown(validClips, evaluations);
      mimeType = "text/markdown;charset=utf-8;";
      filename = `clip-comparison-${Date.now()}.md`;
    } else {
      content = generateComparisonJSON(validClips, evaluations);
      mimeType = "application/json;charset=utf-8;";
      filename = `clip-comparison-${Date.now()}.json`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleCopyReport = () => {
    const md = generateComparisonMarkdown(validClips, evaluations);
    navigator.clipboard.writeText(md).then(() => {
      setCopiedNotification(true);
      setShowExportMenu(false);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (validClips.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-[#121316] border border-white/10 rounded-2xl p-6 max-w-md w-full text-center">
          <p className="text-white font-semibold mb-2">{t("comparison.min_clips_required")}</p>
          <p className="text-zinc-400 text-xs mb-4">Please select 2 to 4 clips from your project to compare them side-by-side.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-brand text-black font-bold text-xs"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  // Grid styling depending on clip count
  const gridClasses =
    validClips.length === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-4"
      : validClips.length === 3
      ? "grid grid-cols-1 md:grid-cols-3 gap-4"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("comparison.title")}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0c0e]/95 backdrop-blur-md text-white overflow-hidden animate-in fade-in duration-200"
    >
      {/* Top Header Bar */}
      <header className="px-6 py-4 border-b border-white/10 bg-[#121316]/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" />
              {t("comparison.title")}
            </h2>
            <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand">
              {validClips.length} Clips Selected
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {t("comparison.subtitle")}
          </p>
        </div>

        {/* Filter and Export controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Rating filter */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={minRatingFilter}
              onChange={(e) => setMinRatingFilter(Number(e.target.value))}
              aria-label={t("comparison.filter_rating")}
              className="bg-transparent text-white focus:outline-none text-xs"
            >
              <option value={0} className="bg-[#18191c]">All Ratings</option>
              <option value={3} className="bg-[#18191c]">3+ Stars</option>
              <option value={4} className="bg-[#18191c]">4+ Stars</option>
              <option value={5} className="bg-[#18191c]">5 Stars Only</option>
            </select>
          </div>

          {/* Winner filter toggle */}
          <button
            type="button"
            onClick={() => setWinnerOnlyFilter((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
              winnerOnlyFilter
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-zinc-300 hover:text-white"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Winners Only</span>
          </button>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white focus:outline-none text-xs"
              aria-label="Sort clips"
            >
              <option value="default" className="bg-[#18191c]">Order: Original</option>
              <option value="score" className="bg-[#18191c]">Sort: Highest Score</option>
              <option value="hook" className="bg-[#18191c]">Sort: Hook Strength</option>
              <option value="visual" className="bg-[#18191c]">Sort: Visual Quality</option>
            </select>
          </div>

          {/* Export Report Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white transition"
              aria-expanded={showExportMenu}
            >
              <Download className="w-3.5 h-3.5 text-brand" />
              <span>{t("comparison.export_report")}</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#16181d] p-1.5 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2">
                <button
                  type="button"
                  onClick={() => handleExportDownload("csv")}
                  className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  {t("comparison.export_csv")}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDownload("md")}
                  className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  {t("comparison.export_markdown")}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDownload("json")}
                  className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  {t("comparison.export_json")}
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-brand" />
                  Copy Markdown Summary
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison view"
            className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Copy Notification Toast */}
      {copiedNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-black px-4 py-2 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4" />
          <span>{t("comparison.report_copied")}</span>
        </div>
      )}

      {/* Synchronized Playback Control Bar */}
      <section
        aria-label={t("comparison.sync_playback")}
        className="px-6 py-3 bg-[#16181d] border-b border-white/5 flex flex-wrap items-center justify-between gap-4 shrink-0"
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-label={isPlaying ? t("comparison.pause_all") : t("comparison.play_all")}
            className="p-2.5 rounded-xl bg-brand text-black font-bold hover:brightness-95 transition shadow-[0_2px_12px_rgba(0,230,138,0.3)]"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label="Restart all clips"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition border border-white/10"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? t("comparison.unmute_all") : t("comparison.mute_all")}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition border border-white/10"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Speed:</span>
            {[0.5, 1, 1.5, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => handleSpeedChange(spd)}
                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                  playbackSpeed === spd ? "bg-brand text-black font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Global Synchronized Timeline Scrubber */}
        <div className="flex-1 max-w-xl flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-400 min-w-10 text-right">
            {Math.floor(currentTime)}s
          </span>
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Synchronized timeline seek"
            className="w-full accent-brand cursor-pointer h-1.5 bg-white/10 rounded-lg"
          />
          <span className="text-xs font-mono text-zinc-400 min-w-10">
            {Math.floor(duration)}s
          </span>
        </div>

        {soloClipId && (
          <div className="text-xs bg-brand/10 border border-brand/20 text-brand px-2.5 py-1 rounded-lg font-medium">
            Solo Audio Active
          </div>
        )}
      </section>

      {/* Main Side-by-Side Comparison Grid */}
      <main className="flex-1 overflow-y-auto p-6">
        {displayedClips.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Filter className="w-8 h-8 text-zinc-500 mb-2" />
            <p className="text-sm font-semibold text-white">No clips match current filter criteria</p>
            <p className="text-xs text-zinc-400 mt-1">Try resetting the rating or winner filter above.</p>
          </div>
        ) : (
          <div className={gridClasses}>
            {displayedClips.map((clip) => {
              const ev = evaluations[clip.id] || {
                rating: 0,
                hookScore: 0,
                visualScore: 0,
                pacingScore: 0,
                isWinner: false,
                notes: "",
              };
              const weightedScore = calculateWeightedScore(clip.score, ev);
              const isSolo = soloClipId === clip.id;

              return (
                <article
                  key={clip.id}
                  className={`flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden bg-[#16181d] ${
                    ev.isWinner
                      ? "border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.25)] ring-1 ring-amber-400/50"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  {/* Top Clip Card Header */}
                  <div className="p-3.5 border-b border-white/5 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <h3 className="text-sm font-bold text-white truncate" title={clip.title}>
                        {sanitize(clip.title)}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                        <span>{clip.duration}</span>
                        <span>•</span>
                        <span>{clip.resolution}</span>
                        <span>•</span>
                        <span className="capitalize">{clip.style}</span>
                      </div>
                    </div>

                    {/* Winner Badge Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleWinner(clip.id)}
                      aria-label={ev.isWinner ? "Selected as top pick" : t("comparison.mark_winner")}
                      className={`shrink-0 p-1.5 rounded-xl border transition flex items-center gap-1 text-xs font-bold ${
                        ev.isWinner
                          ? "bg-amber-400 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      {ev.isWinner && <span>{t("comparison.winner_badge")}</span>}
                    </button>
                  </div>

                  {/* Video Player / Preview Area */}
                  <div className="relative aspect-[9/16] max-h-72 w-full bg-black/50 overflow-hidden flex items-center justify-center">
                    {clip.videoUrl ? (
                      <video
                        ref={(el) => {
                          videoRefs.current[clip.id] = el;
                        }}
                        src={clip.videoUrl}
                        poster={clip.thumbnail}
                        muted={isSolo ? false : soloClipId ? true : isMuted}
                        playsInline
                        loop
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Image
                        src={clip.thumbnail || "/placeholder.png"}
                        alt={clip.title}
                        fill
                        className="object-cover"
                      />
                    )}

                    {/* Solo Audio Button on Player */}
                    <button
                      type="button"
                      onClick={() => handleSoloAudio(clip.id)}
                      title={isSolo ? "Unsolo audio" : t("comparison.solo_audio")}
                      className={`absolute bottom-3 right-3 p-2 rounded-xl backdrop-blur-md transition ${
                        isSolo
                          ? "bg-brand text-black font-bold shadow-lg"
                          : "bg-black/60 text-white/80 hover:text-white"
                      }`}
                    >
                      {isSolo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    {/* Overlay Score Badge */}
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-brand">
                      {weightedScore}/100
                    </div>
                  </div>

                  {/* Interactive Evaluation & Scoring Form */}
                  <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                    {/* Star Rating */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-zinc-300">{t("comparison.rate_clips")}</span>
                        <span className="text-brand">{ev.rating} / 5</span>
                      </div>
                      <div className="flex items-center gap-1.5" role="group" aria-label="Star Rating">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => updateEvaluation(clip.id, { rating: star })}
                            className="p-1 rounded hover:scale-110 transition"
                            aria-label={`${star} star`}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                star <= ev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-zinc-600 hover:text-zinc-400"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-Score Sliders */}
                    <div className="space-y-2 text-xs">
                      {/* Hook Score */}
                      <div>
                        <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-0.5">
                          <span>{t("comparison.hook_score")}</span>
                          <span className="font-mono text-white">{ev.hookScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={ev.hookScore}
                          onChange={(e) =>
                            updateEvaluation(clip.id, { hookScore: parseInt(e.target.value, 10) })
                          }
                          aria-label={t("comparison.hook_score")}
                          className="w-full accent-brand h-1 bg-white/10 rounded cursor-pointer"
                        />
                      </div>

                      {/* Visual Quality */}
                      <div>
                        <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-0.5">
                          <span>{t("comparison.visual_quality")}</span>
                          <span className="font-mono text-white">{ev.visualScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={ev.visualScore}
                          onChange={(e) =>
                            updateEvaluation(clip.id, { visualScore: parseInt(e.target.value, 10) })
                          }
                          aria-label={t("comparison.visual_quality")}
                          className="w-full accent-brand h-1 bg-white/10 rounded cursor-pointer"
                        />
                      </div>

                      {/* Pacing Score */}
                      <div>
                        <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-0.5">
                          <span>{t("comparison.pacing")}</span>
                          <span className="font-mono text-white">{ev.pacingScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={10}
                          value={ev.pacingScore}
                          onChange={(e) =>
                            updateEvaluation(clip.id, { pacingScore: parseInt(e.target.value, 10) })
                          }
                          aria-label={t("comparison.pacing")}
                          className="w-full accent-brand h-1 bg-white/10 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Notes Field */}
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                        {t("comparison.notes")}
                      </label>
                      <textarea
                        rows={2}
                        value={ev.notes || ""}
                        onChange={(e) => updateEvaluation(clip.id, { notes: e.target.value })}
                        placeholder={t("comparison.notes_placeholder")}
                        className="w-full rounded-xl bg-white/5 border border-white/10 p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand resize-none"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
