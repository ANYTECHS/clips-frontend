"use client";

import React, { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjectsData } from "@/lib/queries";
import { CLIPS_PAGE_SIZE } from "@/lib/constants";
import ProjectsContent from "@/components/projects/ProjectsContent";
import { Loader2 } from "lucide-react";

function ProjectsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const videoId = searchParams.get("videoId") ?? undefined;
  const parsedPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const queryClient = useQueryClient();

  const handlePageChange = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete("page");
    else params.set("page", String(next));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // Check if the processing page already seeded the cache
  const cachedClips = queryClient.getQueryData<any[]>(["projectsData", videoId, page]);
  const hasCachedData = Array.isArray(cachedClips) && cachedClips.length > 0;

  const {
    data: clips = [],
    isLoading,
    isFetching,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["projectsData", videoId, page],
    queryFn: () => getProjectsData(videoId, page, CLIPS_PAGE_SIZE),
    // Keep the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
    // If cache is already seeded, treat it as fresh — no refetch on mount
    staleTime: hasCachedData ? 30_000 : 0,
    // Poll fast (every 1 second) while clips are still being retrieved
    refetchInterval: (query) => {
      if (!videoId) return false;
      const hasClips = Array.isArray(query.state.data) && query.state.data.length > 0;
      return hasClips ? false : 1_000;
    },
  });

  // Hard loading — only when there's no cache at all and query hasn't finished initial run
  if (isLoading && !hasCachedData) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#020D08]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#B6FF4A] animate-spin" />
          <p className="text-[#90A89C] text-sm font-medium">Loading clips…</p>
        </div>
      </div>
    );
  }

  return (
    <ProjectsContent
      clips={clips}
      page={page}
      hasNextPage={clips.length >= CLIPS_PAGE_SIZE}
      pageLoading={isFetching && isPlaceholderData}
      onPageChange={handlePageChange}
    />
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-screen bg-[#020D08]">
          <Loader2 className="w-10 h-10 text-[#B6FF4A] animate-spin" />
        </div>
      }
    >
      <ProjectsInner />
    </Suspense>
  );
}
