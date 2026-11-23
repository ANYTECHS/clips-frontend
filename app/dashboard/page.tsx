"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardContent from "@/components/dashboard/DashboardContent";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { DashboardPageSkeleton } from "@/components/shared/SkeletonPresets";
import apiClient from "@/lib/apiClient";

async function getDashboardData() {
  const [videosRes, platformsRes] = await Promise.all([
    apiClient.get("/videos?page=1&limit=6"),
    apiClient.get("/platforms"),
  ]);

  console.log("[DashboardPage] /videos response:", videosRes.data);
  console.log("[DashboardPage] /platforms response:", platformsRes.data);

  const videos = videosRes.data.data || (Array.isArray(videosRes.data) ? videosRes.data : []);
  
  // Sum up clipsCount across all videos
  const totalClips = videos.reduce((acc: number, v: any) => {
    const count = v.clipsCount ?? (Array.isArray(v.clips) ? v.clips.length : 0);
    return acc + count;
  }, 0);

  return {
    stats: {
      earnings: "—",
      clips: totalClips.toString(),
      platforms: String(platformsRes.data.accountCount || 0),
    },
    projects: videos.map((video: any) => ({
      ...video,
      id: video.id,
      title: video.title || "Untitled Video",
      clipsCount: video.clipsCount ?? (Array.isArray(video.clips) ? video.clips.length : 0),
      status: video.status || "completed",
      thumbnail: video.thumbnail || video.thumbnailUrl || video.thumb || video.coverUrl || video.poster || null,
      videoUrl: video.videoUrl || video.url || video.cloudinaryUrl || video.sourceUrl || null,
      clips: video.clips || [],
    })),
    totalVideos: videosRes.data.total || videos.length,
  };
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: getDashboardData,
    retry: false,
    // Refetch when user returns to the dashboard tab
    refetchOnWindowFocus: true,
    // Data is fresh for 10s (don't spam the API on quick navigations)
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardPageSkeleton />
      </DashboardLayout>
    );
  }

  const fallbackData = {
    stats: { earnings: "—", clips: "0", platforms: "0" },
    projects: [],
    totalVideos: 0,
  };

  return <DashboardContent stats={data?.stats || fallbackData.stats} projects={data?.projects || fallbackData.projects} />;
}
