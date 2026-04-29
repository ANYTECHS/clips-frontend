"use client";

import React from "react";
import Skeleton from "../ui/Skeleton";

/**
 * Skeleton loader for NFT cards (NFTCard)
 * Matches the approximate dimensions and layout of NFTCard
 */
export default function VaultCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-[20px] overflow-hidden flex flex-col h-full">
      {/* Thumbnail Area Skeleton */}
      <div className="relative aspect-square">
        <Skeleton className="w-full h-full rounded-none" />
        
        {/* AI Score Badge Skeleton */}
        <div className="absolute top-3 left-3">
          <Skeleton className="w-16 h-7 rounded-lg" />
        </div>

        {/* Status Badge Skeleton */}
        <div className="absolute top-3 right-3">
          <Skeleton className="w-24 h-7 rounded-lg" />
        </div>

        {/* Duration Badge Skeleton */}
        <div className="absolute bottom-3 left-3">
          <Skeleton className="w-14 h-6 rounded-lg" />
        </div>
      </div>

      {/* Content Area Skeleton */}
      <div className="p-4 space-y-4 flex-1 flex flex-col">
        {/* Title Skeleton */}
        <div className="min-h-10 space-y-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md opacity-60" />
        </div>

        {/* Rarity Badge Skeleton */}
        <Skeleton className="h-6 w-20 rounded-lg" />

        {/* Price/Info Skeleton Area */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-4 w-8 rounded-md" />
          </div>
        </div>

        {/* Footer Skeleton */}
        <div className="pt-3 border-t border-border flex justify-between items-center mt-auto">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}
