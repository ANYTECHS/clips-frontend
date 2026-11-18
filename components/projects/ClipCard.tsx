"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Play,
  Download,
  Check,
  Trash2,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Pause,
  Sparkles,
} from "lucide-react";
import { triggerDownload } from "@/lib/download";
import ReadyToPostModal from "@/components/shared/ReadyToPostModal";
import { ReadyToPostKit } from "@/lib/queries";


interface ClipCardProps {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  readyToPostKit?: ReadyToPostKit | null;
}

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800";


function VideoModal({
  clipUrl,
  title,
  onClose,
}: {
  clipUrl: string;
  title: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    setProgress(duration ? (currentTime / duration) * 100 : 0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    videoRef.current.currentTime =
      ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-auto max-w-[90vw] max-h-[90vh] bg-[#06351C] rounded-[24px] overflow-hidden border border-[#0e4d2a] shadow-[0_0_80px_rgba(57,255,20,0.15)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-[#F4F7EF] hover:bg-black transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative bg-[#020D08] flex-1 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={clipUrl}
            className="max-w-full max-h-[70vh] object-contain"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            muted={muted}
            playsInline
          />
          <div
            onClick={togglePlay}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 cursor-pointer ${
              !playing ? "opacity-100 bg-black/30" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              <Play className="w-7 h-7 text-[#F4F7EF] fill-[#F4F7EF] ml-1" />
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#042413] border-t border-[#0e4d2a] space-y-2">
          <div
            className="h-1.5 w-full bg-[#020D08] rounded-full overflow-hidden cursor-pointer"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-[#B6FF4A] rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-[#F4F7EF] truncate max-w-[280px] sm:max-w-md">
              {title}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg bg-[#06351C] text-[#F4F7EF] hover:bg-[#084223] transition-colors"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.muted = !muted;
                    setMuted(!muted);
                  }
                }}
                className="p-1.5 rounded-lg bg-[#06351C] text-[#F4F7EF] hover:bg-[#084223] transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ClipCard({
  id,
  title: initialTitle,
  thumbnail,
  clipUrl,
  score: _score,
  scoreKey: _scoreKey,
  duration,
  isSelected,
  onSelect,
  onDelete,
  readyToPostKit,
}: ClipCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgSrc, setImgSrc] = useState(thumbnail || FALLBACK_IMG);
  const [showPreview, setShowPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setImgSrc(thumbnail || FALLBACK_IMG);
  }, [thumbnail]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(id);
    } catch {
      setIsDeleting(false);
    }
  };

  const openPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clipUrl) setShowPreview(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const downloadTarget = readyToPostKit?.downloadUrl || clipUrl;
    if (!downloadTarget) return;
    triggerDownload(downloadTarget, initialTitle);
  };

  const [showPostKit, setShowPostKit] = useState(false);

  return (
    <>
      {showPreview && clipUrl && (
        <VideoModal clipUrl={clipUrl} title={initialTitle} onClose={() => setShowPreview(false)} />
      )}

      {showPostKit && (
        <ReadyToPostModal
          clip={{
            id,
            title: initialTitle,
            thumbnail,
            clipUrl,
            duration,
            readyToPostKit,
          }}
          onClose={() => setShowPostKit(false)}
        />
      )}

      <div
        className={`group relative bg-[#06351C] border rounded-[24px] overflow-hidden transition-all duration-500 ${
          isSelected
            ? "border-[#39FF14] ring-1 ring-[#39FF14]/30 shadow-[0_0_40px_rgba(57,255,20,0.15)]"
            : "border-[#0e4d2a] hover:border-[#39FF14]/40 hover:shadow-[0_0_35px_rgba(57,255,20,0.12)]"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-[#031d0f]">
          <Image
            src={imgSrc}
            alt={initialTitle}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover"
            onError={() => setImgSrc(FALLBACK_IMG)}
          />

          {/* Selection checkbox */}
          <div
            onClick={(e) => { e.stopPropagation(); onSelect(id); }}
            className={`absolute top-3 left-3 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer z-20 ${
              isSelected
                ? "bg-[#B6FF4A] border-[#B6FF4A] shadow-[0_0_15px_rgba(57,255,20,0.4)]"
                : "bg-black/50 border-[#0e4d2a] hover:border-[#B6FF4A]/50 backdrop-blur-md"
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5 text-[#020D08] stroke-[4px]" />}
          </div>

          {/* Play overlay */}
          <div
            onClick={openPreview}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 z-10 ${
              isHovered && clipUrl
                ? "opacity-100 bg-black/40 backdrop-blur-[2px] cursor-pointer"
                : "opacity-0"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl">
              <Play className="w-4 h-4 text-[#F4F7EF] fill-[#F4F7EF] ml-1" />
            </div>
          </div>

          {/* Duration */}
          <div className="absolute bottom-2.5 right-3 px-1.5 py-0.5 rounded-md bg-black/80 text-[9px] font-black text-[#F4F7EF] z-20">
            {duration}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5">
          <div className="space-y-1">
            <h4 className="text-[14px] font-bold text-[#F4F7EF] truncate tracking-tight leading-tight group-hover:text-[#B6FF4A] transition-colors">
              {initialTitle}
            </h4>
            <p className="text-[11px] font-medium text-[#90A89C]">
              Perfect for TikTok, Reels & Shorts
            </p>
          </div>

          {/* Action Row 1: Ready-to-Post Kit (Primary Action) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPostKit(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] text-[11px] font-black uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(57,255,20,0.25)] active:scale-[0.98]"
            title="Open Ready-to-Post Kit with captions, hashtags & one-click sharing"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Ready-to-Post Kit</span>
          </button>

          {/* Action Row 2: Download HD, Preview & Delete with clear spacing */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#0e4d2a]/60">
            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={!clipUrl && !readyToPostKit?.downloadUrl}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#031d0f] hover:bg-[#084223] border border-[#0e4d2a] hover:border-[#B6FF4A]/40 text-[#F4F7EF] hover:text-[#B6FF4A] text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              title={clipUrl || readyToPostKit?.downloadUrl ? "Download HD Clip (MP4)" : "No download available"}
            >
              <Download className="w-3.5 h-3.5 text-[#B6FF4A] shrink-0" />
              <span>Download</span>
            </button>

            {/* Preview button */}
            <button
              onClick={openPreview}
              disabled={!clipUrl}
              className="flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-[#031d0f] hover:bg-[#084223] border border-[#0e4d2a] text-[#F4F7EF] text-[11px] font-bold transition-all disabled:opacity-30 active:scale-[0.98]"
              title={clipUrl ? "Preview clip with audio" : "No preview available"}
            >
              <Play className="w-3 h-3 fill-current text-[#F4F7EF] shrink-0 ml-0.5" />
              <span>Preview</span>
            </button>

            {/* Delete button */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#031d0f] hover:bg-red-500/10 border border-[#0e4d2a] hover:border-red-500/30 text-[#90A89C] hover:text-red-400 transition-all disabled:opacity-40 shrink-0 active:scale-[0.95]"
              title="Delete this clip"
              aria-label="Delete clip"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
