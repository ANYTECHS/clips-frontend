"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { TrendingUp, Loader2, Sparkles } from "lucide-react";
import analytics from "@/app/lib/analytics";

interface TrendingClip {
  id: string;
  title: string;
  thumbnail: string;
  score: number;
  style: string;
  duration: string;
  creatorUsername: string;
  shareId: string;
}

export default function ExploreFeed() {
  const [clips, setClips] = useState<TrendingClip[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchClips = useCallback(async (nextCursor?: string) => {
    const isInitial = !nextCursor;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: "20" });
      if (nextCursor) params.set("cursor", nextCursor);

      const res = await fetch(`/api/explore/trending?${params}`);
      if (!res.ok) return;

      const json = await res.json();
      const newClips: TrendingClip[] = json.data?.clips ?? [];
      const newCursor: string | null = json.data?.nextCursor ?? null;

      setClips((prev) => (isInitial ? newClips : [...prev, ...newClips]));
      setCursor(newCursor);
      setHasMore(Boolean(newCursor));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchClips();
    analytics.trackEvent("explore_page_view");
  }, [fetchClips]);

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) fetchClips(cursor);
      },
      { rootMargin: "200px" },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, cursor, fetchClips]);

  const handleClipClick = (clip: TrendingClip) => {
    analytics.trackEvent("explore_clip_click", { clipId: clip.id, score: clip.score });
    analytics.trackEvent("explore_conversion_intent", { source: "clip_card" });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="text-center py-20">
        <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No trending clips yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {clips.map((clip) => (
          <Link
            key={clip.id}
            href={`/share/${clip.shareId}`}
            onClick={() => handleClipClick(clip)}
            className="group rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-brand/40 transition-all hover:shadow-[0_0_20px_rgba(0,229,143,0.15)]"
          >
            <div className="aspect-[9/16] relative">
              <Image
                src={clip.thumbnail}
                alt={clip.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-brand text-black px-2 py-1 rounded-lg text-xs font-bold">
                <TrendingUp className="w-3 h-3" />
                {clip.score}
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">{clip.title}</h3>
                <p className="text-white/60 text-xs">@{clip.creatorUsername}</p>
                <p className="text-white/40 text-[10px] mt-1">{clip.style} · {clip.duration}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {(hasMore || loadingMore) && (
        <div ref={loadMoreRef} className="py-10 flex justify-center">
          {loadingMore && <Loader2 className="w-6 h-6 animate-spin text-brand" />}
        </div>
      )}
    </>
  );
}
