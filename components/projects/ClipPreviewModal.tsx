"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Play, Pause, Volume2, VolumeX, Share2, TrendingUp } from "lucide-react";
import type { Clip } from "./ClipGrid";

export interface ClipPreviewModalProps {
  clip: Clip;
  onClose: () => void;
}

export default function ClipPreviewModal({ clip, onClose }: ClipPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative bg-[#111] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors"
          aria-label="Close preview"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Player */}
        <div className="flex-1 relative bg-black aspect-[9/16] md:aspect-auto md:h-[80vh] flex items-center justify-center group">
          <video
            ref={videoRef}
            src={clip.videoUrl}
            poster={clip.thumbnail}
            className="w-full h-full object-contain"
            loop
            playsInline
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Overlay Controls */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={togglePlay}
                className="p-3 rounded-full bg-brand text-black hover:bg-brand-hover transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              
              <button
                onClick={toggleMute}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {/* Big center play button when paused */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-6 rounded-full bg-brand/90 text-black hover:bg-brand hover:scale-110 transition-all duration-300 shadow-[0_0_30px_rgba(var(--brand),0.4)]"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
          )}
        </div>

        {/* Metadata Sidebar */}
        <div className="w-full md:w-[320px] lg:w-[400px] p-6 md:p-8 flex flex-col bg-[#111] border-l border-white/10">
          <div className="flex-1 space-y-6">
            <div>
              <h2 id="preview-title" className="text-2xl font-extrabold text-white mb-2 leading-tight">
                {clip.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/50">
                <span>{clip.duration}</span>
                <span>•</span>
                <span>{clip.resolution}</span>
                <span>•</span>
                <span className="capitalize">{clip.status}</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-5 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-brand/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-brand" />
                </div>
                <h3 className="text-white font-bold text-lg">Virality Score</h3>
              </div>
              
              <div className="flex items-end gap-3 mb-2">
                <span className={`text-4xl font-black ${
                  clip.scoreKey === 'high' ? 'text-green-500' : 
                  clip.scoreKey === 'medium' ? 'text-yellow-500' : 
                  'text-red-500'
                }`}>
                  {clip.score}
                </span>
                <span className="text-white/50 font-medium mb-1">/ 100</span>
              </div>
              
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    clip.scoreKey === 'high' ? 'bg-green-500' : 
                    clip.scoreKey === 'medium' ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${clip.score}%` }}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-white/70 font-semibold uppercase text-xs tracking-wider">Clip Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-white/50 mb-1">Style</span>
                  <span className="text-sm font-medium text-white">{clip.style}</span>
                </div>
                <div>
                  <span className="block text-xs text-white/50 mb-1">Created</span>
                  <span className="text-sm font-medium text-white">Just now</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 flex gap-3">
            <button className="flex-1 py-3.5 rounded-xl text-sm font-medium bg-white/5 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-brand text-black hover:bg-brand-hover transition-colors shadow-[0_0_15px_rgba(var(--brand),0.3)]">
              Mint as NFT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
