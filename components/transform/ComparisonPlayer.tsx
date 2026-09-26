"use client";

import React, { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useVideoReleaseAll } from "@/app/hooks/useVideoRelease";

interface ComparisonPlayerProps {
  originalSrc: string;
  transformedSrc: string;
}

export default function ComparisonPlayer({ originalSrc, transformedSrc }: ComparisonPlayerProps) {
  const origRef = useRef<HTMLVideoElement>(null);
  const transRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  // Two videos, and both sources change every time a new transform finishes —
  // the case a plain unmount cleanup misses, because the elements stay mounted
  // and the previous resources are orphaned in place (#1066).
  useVideoReleaseAll([origRef, transRef], `${originalSrc}|${transformedSrc}`);

  const toggle = () => {
    const orig = origRef.current;
    const trans = transRef.current;
    if (!orig || !trans) return;
    if (playing) {
      orig.pause();
      trans.pause();
    } else {
      orig.play().catch(() => {});
      trans.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Original</span>
          <video
            ref={origRef}
            src={originalSrc}
            className="w-full rounded-2xl border border-white/10 bg-black aspect-video object-contain"
            playsInline
            loop
            preload="metadata"
          />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Transformed</span>
          <video
            ref={transRef}
            src={transformedSrc}
            className="w-full rounded-2xl border border-brand/20 bg-black aspect-video object-contain"
            playsInline
            loop
            preload="metadata"
          />
        </div>
      </div>
      <div className="flex justify-center">
        <button
          onClick={toggle}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand text-black text-xs font-bold hover:bg-brand-hover transition-all"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? "Pause" : "Play"} Both
        </button>
      </div>
    </div>
  );
}
