"use client";

import React, { useRef, useEffect, useState } from "react";
import { X, Play, Download, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

interface ClipPreviewModalProps {
  clip: { 
    id: string; 
    title: string; 
    thumbnail: string; 
    duration: string; 
    score: number;
    resolution?: string;
    videoUrl?: string;
  };
  onClose: () => void;
  onDownload?: (id: string) => void;
}

export default function ClipPreviewModal({ clip, onClose, onDownload }: ClipPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Close on Escape & Play/Pause on Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Auto-play when modal opens (muted)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

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
              {clip.resolution && (
                <span className="text-[12px] text-muted-foreground">{clip.resolution}</span>
              )}
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
        <div className="relative bg-black aspect-video group">
          <video
            ref={videoRef}
            className="w-full h-full object-contain cursor-pointer"
            poster={clip.thumbnail}
            playsInline
            preload="auto"
            loop
            muted={isMuted}
            onClick={togglePlay}
            aria-label={`Video preview of ${clip.title}`}
          >
            {clip.videoUrl ? (
              <source src={clip.videoUrl} type="video/mp4" />
            ) : (
              <source src="" type="video/mp4" />
            )}
            {/* Captions track support */}
            <track kind="captions" src="" label="English" default />
            Your browser does not support the video element.
          </video>

          {/* Custom Controls Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {!isPlaying && (
              <div className="w-16 h-16 rounded-full bg-black/40 border border-white/20 flex items-center justify-center backdrop-blur-xl">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlay}
                className="text-white hover:text-brand transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button 
                onClick={toggleMute}
                className="text-white hover:text-brand transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
            <button 
              onClick={toggleFullscreen}
              className="text-white hover:text-brand transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>

          {!clip.videoUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/60">
              <p className="text-[12px] text-white/50">Video source not available</p>
            </div>
          )}
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
