"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getDashboardData, getVideos } from "@/lib/queries";
import { loadActiveJob, clearActiveJob } from "@/lib/processingStore";
import DashboardLayout from "@/components/shared/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import ProjectCard from "@/components/dashboard/ProjectCard";
import { Video, Globe, ChevronDown, Loader2, Sparkles, X } from "lucide-react";

interface DashboardContentProps {
  stats: {
    earnings: string;
    clips: string;
    platforms: string;
  };
  projects: any[];
}

export default function DashboardContent({ stats: initialStats, projects: initialProjects }: DashboardContentProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allProjects, setAllProjects] = useState(initialProjects);

  const [activeJob, setActiveJob] = useState<{ videoId: string; startedAt: number } | null>(null);

  useEffect(() => {
    const job = loadActiveJob();
    if (!job) return;

    const AGE_LIMIT = 30 * 60 * 1000;
    if (Date.now() - job.startedAt > AGE_LIMIT) {
      clearActiveJob();
      return;
    }
    setActiveJob(job);
  }, []);

  const dismissBanner = () => {
    clearActiveJob();
    setActiveJob(null);
  };

  const { data } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: getDashboardData,
    initialData: { stats: initialStats, projects: initialProjects, totalVideos: initialProjects.length },
  });

  const { stats } = data;
  const hasMore = allProjects.length < (data.totalVideos || 0);

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await getVideos(nextPage);
      const newItems = response.items || [];
      setAllProjects(prev => [...prev, ...newItems]);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more projects:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="px-4 sm:px-6 lg:px-10 py-8 space-y-10 max-w-[1400px] mx-auto w-full">

        {activeJob && (
          <div className="relative flex items-center justify-between gap-4 px-6 py-4 rounded-2xl bg-[#06351C] border border-[#39FF14]/30 shadow-[0_0_30px_rgba(57,255,20,0.1)]">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-[#39FF14]/30 blur-md animate-pulse" />
                <div className="relative w-9 h-9 rounded-full bg-[#042413] border border-[#39FF14]/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#39FF14]" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#F4F7EF] leading-snug">
                  Your video is still being processed
                </p>
                <p className="text-xs text-[#90A89C] font-medium mt-0.5 truncate">
                  AI is cutting clips in the background — tap to watch progress
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => router.push(`/dashboard/processing?videoId=${activeJob.videoId}`)}
                className="px-5 py-2 rounded-xl bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] text-xs font-black tracking-wide transition-all active:scale-[0.97] shadow-[0_0_15px_rgba(57,255,20,0.25)]"
              >
                Resume
              </button>
              <button
                onClick={dismissBanner}
                aria-label="Dismiss"
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/5 text-[#90A89C] hover:text-[#F4F7EF] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard 
            label="Total Clips Generated" 
            value={stats.clips} 
            trend="+8.2%" 
            icon={Video} 
          />
          <StatCard 
            label="Active Platforms" 
            value={stats.platforms} 
            trend="Steady" 
            icon={Globe} 
          />
        </div>

        {/* Bottom Section: Recent Projects */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[20px] font-extrabold text-[#F4F7EF] tracking-tight">Recent Projects</h3>
            <div className="text-[13px] text-[#90A89C] font-medium">
              Showing {allProjects.length} of {data.totalVideos || allProjects.length}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
            {allProjects.map((project: any, index: number) => (
              <ProjectCard 
                key={project.id || index}
                id={project.id}
                title={project.title}
                clipsCount={project.clipsCount}
                status={project.status}
                thumbnail={project.thumbnail}
                videoUrl={project.videoUrl || project.url || project.cloudinaryUrl || project.sourceUrl}
                clips={project.clips}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-8">
              <button 
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-[#06351C] border border-[#0e4d2a] text-[#F4F7EF] rounded-xl font-bold hover:bg-[#084223] hover:border-[#39FF14]/40 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#B6FF4A]" />
                ) : (
                  <>
                    Load More Projects
                    <ChevronDown className="w-5 h-5 text-[#B6FF4A]" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
