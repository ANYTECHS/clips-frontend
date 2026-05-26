"use client";

import React, { useRef, useEffect } from "react";
import { X, Play, Download } from "lucide-react";

interface ClipPreviewModalProps {
  clip: { id: string; title: string; thumbnail: string; duration: string; score: number };
  onClose: () => void;
  onDownload?: (id: string) => void;
}

export default function ClipPreviewModal({ clip, onClose, onDownload }: ClipPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-play when modal opens
  useEffect(() => {
    videoRef.current?.play().catch(() => {/* autoplay blocked — user can click play */});
  }, []);

  const getScoreColor = (s: number) =>
    s >= 90 ? "text-brand" : s >= 70 ? "text-yellow-400" : "text-red-400";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-[#0C120F] border border-white/10 rounded-[28px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-white truncate">{clip.title}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[12px] text-muted-foreground">{clip.duration}</span>
              <span className={`text-[12px] font-black ${getScoreColor(clip.score)}`}>
                AI Score {clip.score}%
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5 transition-all shrink-0 ml-4"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black aspect-video">
          {/* HTML5 video — falls back to poster (thumbnail) when no real src is available */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            poster={clip.thumbnail}
            controls
            playsInline
            preload="metadata"
            aria-label={`Preview of ${clip.title}`}
          >
            {/* In production, replace with real clip URL e.g. /api/clips/{clip.id}/stream */}
            <source src="" type="video/mp4" />
            Your browser does not support the video element.
          </video>

          {/* Overlay shown when no real video src — remove once real URLs are wired */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-xl mb-3">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
            <p className="text-[12px] text-white/50">Connect a real video source to enable playback</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
          <p className="text-[12px] text-muted-foreground">Perfect for TikTok &amp; Reels</p>
          <div className="flex items-center gap-3">
            {onDownload && (
              <button
                onClick={() => onDownload(clip.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-[13px] font-bold text-muted-foreground hover:text-white transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-brand text-black text-[13px] font-black hover:shadow-[0_0_20px_rgba(0,229,143,0.3)] transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
