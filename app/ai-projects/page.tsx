"use client";

import React, { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient from "@/lib/apiClient";
import DashboardLayout from "@/components/shared/DashboardLayout";
import AIProjectsContent from "@/components/ai-projects/AIProjectsContent";
import { Loader2 } from "lucide-react";

// AI-powered platform suggestion based on clip characteristics
function suggestPlatform(clip: any): string {
  const duration = clip.duration || 0;
  const score = clip.viralScore ?? clip.score ?? 0;
  
  if (duration < 30) return "TikTok";
  if (duration >= 30 && duration < 60) return "YouTube Shorts";
  if (duration >= 60 && duration < 120) return "Instagram Reels";
  if (score >= 80) return "Multi-Platform";
  return "TikTok";
}

async function getClipsFeed(page = 1, limit = 20) {
  const response = await apiClient.get(`/clips/feed?page=${page}&limit=${limit}`);
  const raw = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
  const meta = response.data?.meta ?? {};
  const total =
    typeof meta.total === "number"
      ? meta.total
      : typeof response.data?.total === "number"
      ? response.data.total
      : raw.length;
  const totalPages =
    typeof meta.totalPages === "number"
      ? meta.totalPages
      : Math.max(1, Math.ceil(total / limit));

  // First pass — map what the feed gives us
  const clips: any[] = raw.map((clip: any) => {
    const score = clip.viralScore ?? clip.score ?? 0;
    const ownerObj = clip.owner ?? null;
    const creatorAddress =
      ownerObj?.stellarAddress ||
      clip.ownerWallet ||
      clip.creatorAddress ||
      clip.stellarAddress ||
      undefined;
    const creatorName =
      ownerObj?.username ||
      ownerObj?.name ||
      ownerObj?.fullName ||
      clip.creatorName ||
      clip.ownerName ||
      undefined;

    return {
      id: String(clip.id),
      title: clip.title || `Clip #${clip.id}`,
      thumbnail: clip.thumbnail || null,
      clipUrl: clip.clipUrl || null,
      score,
      scoreKey: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
      duration: clip.duration
        ? `${Math.floor(clip.duration / 60).toString().padStart(2, "0")}:${Math.floor(clip.duration % 60).toString().padStart(2, "0")}`
        : "00:00",
      platform: clip.platform || clip.suggestedPlatform || suggestPlatform(clip),
      createdAt: clip.createdAt || null,
      creatorAddress,
      creatorName,
      tippingEnabled: clip.tippingEnabled ?? (ownerObj?.walletConnected ? true : false),
      readyToPostKit: clip.readyToPostKit || null,
    };
  });

  // Second pass — fetch /clips/:id/info for every clip that still has no address.
  const missingIdx = clips
    .map((c, i) => (!c.creatorAddress ? i : -1))
    .filter((i) => i !== -1);

  if (missingIdx.length > 0) {
    const BATCH = 10;
    for (let b = 0; b < missingIdx.length; b += BATCH) {
      const batchIdx = missingIdx.slice(b, b + BATCH);
      await Promise.all(
        batchIdx.map(async (idx) => {
          const clip = clips[idx];
          try {
            const res = await apiClient.get(`/clips/${clip.id}/info`);
            const info = res.data;
            const owner = info?.owner;
            if (owner?.stellarAddress) {
              clips[idx] = {
                ...clip,
                creatorAddress: owner.stellarAddress,
                creatorName: owner.username || owner.name || clip.creatorName,
                tippingEnabled: info.tippingEnabled ?? !!owner.stellarAddress,
              };
            }
          } catch (e: any) {
            console.warn(`[feed] /clips/${clip.id}/info failed:`, e?.response?.status);
          }
        })
      );
    }
  }

  return {
    clips,
    total,
    page,
    limit,
    totalPages,
  };
}

function AIProjectsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = 20;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["clipsFeed", page, limit],
    queryFn: () => getClipsFeed(page, limit),
    staleTime: 30_000,
    retry: 2,
    placeholderData: (previousData) => previousData,
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`/ai-projects?${params.toString()}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#B6FF4A] animate-spin" />
          <p className="text-[#90A89C] text-sm font-medium">Loading AI clips…</p>
        </div>
      </div>
    );
  }

  return (
    <AIProjectsContent
      clips={data?.clips || []}
      total={data?.total ?? 0}
      currentPage={data?.page ?? page}
      totalPages={data?.totalPages ?? 1}
      limit={limit}
      isFetching={isFetching}
      onPageChange={handlePageChange}
    />
  );
}

export default function AIProjectsPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 text-[#B6FF4A] animate-spin" />
          </div>
        }
      >
        <AIProjectsInner />
      </Suspense>
    </DashboardLayout>
  );
}
