"use client";

import React from "react";
import Skeleton from "../ui/Skeleton";

/**
 * Skeleton loader for Project cards (ClipCard)
 * Matches the approximate dimensions and layout of ClipCard
 */
export default function ProjectCardSkeleton() {
  return (
    <div className="bg-input border border-white/5 rounded-[24px] sm:rounded-[32px] overflow-hidden flex flex-col h-full">
      {/* Thumbnail Area Skeleton */}
      <div className="relative aspect-video">
        <Skeleton className="w-full h-full rounded-none" />
        
        {/* Selection Indicator Skeleton */}
        <div className="absolute top-4 left-4">
          <Skeleton className="w-6 h-6 rounded-lg" />
        </div>

        {/* Score Badge Skeleton */}
        <div className="absolute top-4 right-4">
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>

        {/* Duration Skeleton */}
        <div className="absolute bottom-4 right-4">
          <Skeleton className="w-10 h-5 rounded-md" />
        </div>
      </div>

      {/* Content Area Skeleton */}
      <div className="p-4 sm:p-6 space-y-4 flex-1 flex flex-col">
        <div className="space-y-2">
          {/* Title Skeleton */}
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md opacity-60" />
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          {/* Action Buttons Skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
          
          {/* Preview Link Skeleton */}
          <Skeleton className="w-16 h-4 rounded-md" />
        </div>
      </div>
    </div>
  );
}
