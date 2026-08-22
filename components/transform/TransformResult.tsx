"use client";

/**
 * TransformResult.tsx — Side-by-side comparison UI for original vs transformed videos.
 *
 * Features:
 * - Drag-to-compare slider for pixel-perfect comparison
 * - Synchronized playback (play/pause/scrub affects both)
 * - Watermark badge showing transform style
 * - Fullscreen toggle
 * - Share comparison link generation
 */

import React, { useRef, useState, useEffect } from "react";
import { Copy, Fullscreen, Share2, Sparkles, Maximize2, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransformResultProps {
  /** URL of the original clip video file */
  originalUrl: string;
  /** URL of the transformed clip video file */
  transformedUrl: string;
  /** The style name (e.g., "anime", "cinematic") for the watermark */
  styleName: string;
  /** Optional callback when user requests to share the comparison */
  onShare?: () => void;
  /** Optional share link to display in share dialog */
  shareLink?: string | null;
}

// ─── Slider Dragging Handler ──────────────────────────────────────────────────

/**
 * Hook to manage drag-to-compare slider state and handlers.
 */
function useDragComparison() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50); // 0-100 percentage
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(percent);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPos(percent);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchend", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  return { containerRef, sliderPos, isDragging, handleMouseDown, handleTouchStart };
}

// ─── Synchronized Video Players ────────────────────────────────────────────────

interface SyncedVideosProps {
  originalUrl: string;
  transformedUrl: string;
  styleName: string;
  sliderPos: number;
  isDragging: boolean;
  onMouseDown: () => void;
  onTouchStart: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

function SyncedVideos({
  originalUrl,
  transformedUrl,
  styleName,
  sliderPos,
  isDragging,
  onMouseDown,
  onTouchStart,
  containerRef,
}: SyncedVideosProps) {
  const origRef = useRef<HTMLVideoElement>(null);
  const transRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Sync play/pause between videos
  const togglePlay = () => {
    const orig = origRef.current;
    const trans = transRef.current;
    if (!orig || !trans) return;

    if (isPlaying) {
      orig.pause();
      trans.pause();
    } else {
      orig.play().catch(() => {});
      trans.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  // Sync scrubbing/seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (origRef.current) origRef.current.currentTime = time;
    if (transRef.current) transRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Keep videos in sync during playback
  const handleOrigTimeUpdate = () => {
    if (origRef.current && transRef.current && !isDragging) {
      const diff = Math.abs(origRef.current.currentTime - transRef.current.currentTime);
      if (diff > 0.1) {
        transRef.current.currentTime = origRef.current.currentTime;
      }
      setCurrentTime(origRef.current.currentTime);
    }
  };

  const handleTransTimeUpdate = () => {
    if (transRef.current && origRef.current && !isDragging) {
      const diff = Math.abs(transRef.current.currentTime - origRef.current.currentTime);
      if (diff > 0.1) {
        origRef.current.currentTime = transRef.current.currentTime;
      }
      setCurrentTime(transRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (origRef.current) setDuration(origRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Main comparison container */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video border border-white/10 group cursor-col-resize"
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Original video */}
        <video
          ref={origRef}
          src={originalUrl}
          className="absolute inset-0 w-full h-full object-contain"
          playsInline
          onTimeUpdate={handleOrigTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        {/* Transformed video (clipped to slider position) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <video
            ref={transRef}
            src={transformedUrl}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ width: `${containerRef.current?.offsetWidth}px` }}
            playsInline
            onTimeUpdate={handleTransTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
        </div>

        {/* Watermark on transformed side */}
        <div
          className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 backdrop-blur-sm border border-white/20 rounded-full text-xs font-bold text-white"
          style={{
            right: `${100 - sliderPos}%`,
            transform: "translateX(50%)",
            opacity: sliderPos > 20 ? 1 : 0.5,
            transition: "opacity 0.2s ease",
          }}
        >
          <Sparkles className="w-3 h-3 text-brand" />
          {styleName}
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-brand/80 hover:bg-brand transition-colors"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-brand bg-brand/20 flex items-center justify-center shadow-lg transition-all hover:w-14 hover:h-14">
            <div className="flex gap-1">
              <div className="w-0.5 h-4 bg-brand rounded-full" />
              <div className="w-0.5 h-4 bg-brand rounded-full" />
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-4 left-4 text-xs font-bold text-white bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
          Original
        </div>
        <div
          className="absolute top-4 left-4 text-xs font-bold text-brand bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-brand/20"
          style={{
            right: "auto",
            left: `${sliderPos}%`,
            transform: "translateX(-50%)",
            opacity: sliderPos < 80 ? 1 : 0.5,
            transition: "opacity 0.2s ease",
          }}
        >
          Transformed
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Play/Pause and seekbar */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-brand text-black hover:bg-brand-hover transition-colors flex items-center justify-center"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Seekbar */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground min-w-fit">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-input rounded-full appearance-none cursor-pointer accent-brand"
              style={{
                background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${
                  duration ? (currentTime / duration) * 100 : 0
                }%, var(--color-input) ${duration ? (currentTime / duration) * 100 : 0}%, var(--color-input) 100%)`,
              }}
            />
            <span className="text-xs font-semibold text-muted-foreground min-w-fit">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground text-center">
          Drag the slider left and right to compare videos
        </p>
      </div>
    </div>
  );
}

// ─── Share Dialog ──────────────────────────────────────────────────────────────

interface ShareDialogProps {
  isOpen: boolean;
  shareLink: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

function ShareDialog({ isOpen, shareLink, onClose, onRefresh }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-white/10 rounded-2xl max-w-sm w-full space-y-6 p-6 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Share Comparison</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-input rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {shareLink ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link to let others view the side-by-side comparison.
            </p>
            <div className="flex items-center gap-2 p-3 bg-input border border-white/10 rounded-lg">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 bg-transparent text-xs font-mono text-muted-foreground outline-none"
              />
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-2 hover:bg-surface rounded transition-colors"
                aria-label="Copy link"
              >
                <Copy className="w-4 h-4 text-brand" />
              </button>
            </div>
            {copied && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1 h-1 bg-green-400 rounded-full" /> Copied to clipboard
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Click the button below to generate a shareable link for this comparison.
            </p>
            <button
              onClick={onRefresh}
              className="w-full px-4 py-2.5 bg-brand text-black font-bold text-sm rounded-lg hover:bg-brand-hover transition-colors"
            >
              Generate Share Link
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 border border-white/10 rounded-lg hover:bg-input transition-colors text-sm font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function TransformResult({
  originalUrl,
  transformedUrl,
  styleName,
  onShare,
  shareLink: initialShareLink,
}: TransformResultProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(initialShareLink ?? null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const { containerRef, sliderPos, isDragging, handleMouseDown, handleTouchStart } =
    useDragComparison();

  const handleToggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return;

    try {
      if (isFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await fullscreenContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleShareClick = () => {
    setIsShareOpen(true);
    if (onShare && !shareLink) {
      onShare();
    }
  };

  const handleGenerateShareLink = () => {
    if (onShare) {
      onShare();
    }
  };

  // Handle fullscreen change event
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <>
      <div
        ref={fullscreenContainerRef}
        className={`flex flex-col gap-4 ${isFullscreen ? "fixed inset-0 z-50 bg-black p-4" : ""}`}
      >
        {/* Header with controls */}
        {isFullscreen && (
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">Transform Comparison</h1>
            <button
              onClick={handleToggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Exit fullscreen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Video comparison */}
        <div className={`flex-1 ${isFullscreen ? "min-h-0" : ""}`}>
          <SyncedVideos
            originalUrl={originalUrl}
            transformedUrl={transformedUrl}
            styleName={styleName}
            sliderPos={sliderPos}
            isDragging={isDragging}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            containerRef={containerRef}
          />
        </div>

        {/* Action buttons */}
        {!isFullscreen && (
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleToggleFullscreen}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-input hover:bg-surface border border-white/10 text-white text-sm font-bold transition-colors"
              aria-label="Fullscreen"
            >
              <Fullscreen className="w-4 h-4" />
              Fullscreen
            </button>
            <button
              onClick={handleShareClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand text-black font-bold text-sm hover:bg-brand-hover transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share Comparison
            </button>
          </div>
        )}
      </div>

      {/* Share dialog */}
      <ShareDialog
        isOpen={isShareOpen}
        shareLink={shareLink}
        onClose={() => setIsShareOpen(false)}
        onRefresh={handleGenerateShareLink}
      />
    </>
  );
}

export default TransformResult;
