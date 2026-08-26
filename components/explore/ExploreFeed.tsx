"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TrendingUp, Loader2, Sparkles } from "lucide-react";
import analytics from "@/app/lib/analytics";
import LazyImage from "@/components/common/LazyImage";
import AsyncBoundary from "@/components/common/AsyncBoundary";
import { CardGridSkeleton } from "@/components/ui/SkeletonPresets";
import { useApiQuery, cacheKey } from "@/app/hooks/useApiQuery";
import { useApiMutation } from "@/app/hooks/useApiMutation";
import { apiFetch } from "@/app/lib/apiError";

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

interface TrendingPage {
  clips: TrendingClip[];
  nextCursor: string | null;
}

interface TrendingResponse {
  data: TrendingPage;
}

export default function ExploreFeed() {
  const [clips, setClips] = useState<TrendingClip[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, refresh } = useApiQuery<TrendingResponse>(
    cacheKey("/api/explore/trending", { limit: 20 }),
    "/api/explore/trending?limit=20",
    { retry: 2 },
  );

  useEffect(() => {
    if (!data) return;
    setClips(data.data?.clips ?? []);
    setCursor(data.data?.nextCursor ?? null);
    setHasMore(Boolean(data.data?.nextCursor));
  }, [data]);

  useEffect(() => {
    analytics.trackEvent("explore_page_view");
  }, []);

  const { mutate: loadMore, loading: loadingMore } = useApiMutation<TrendingPage, string>(
    async (nextCursor) => {
      const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
      const res = await apiFetch<TrendingResponse>(`/api/explore/trending?${params}`);
      return res.data;
    },
    {
      onSuccess: (page) => {
        setClips((prev) => [...prev, ...page.clips]);
        setCursor(page.nextCursor);
        setHasMore(Boolean(page.nextCursor));
      },
    },
  );

  useEffect(() => {
    if (!hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) loadMore(cursor);
      },
      { rootMargin: "200px" },
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, cursor, loadMore]);

  const handleClipClick = (clip: TrendingClip) => {
    analytics.trackEvent("explore_clip_click", { clipId: clip.id, score: clip.score });
    analytics.trackEvent("explore_conversion_intent", { source: "clip_card" });
  };

  return (
    <AsyncBoundary loading={loading} error={error} onRetry={refresh} skeleton={<CardGridSkeleton />}>
      {clips.length === 0 ? (
        <div className="text-center py-20">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No trending clips yet. Check back soon!</p>
        </div>
      ) : (
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
                  <LazyImage
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
      )}
    </AsyncBoundary>
  );
}
