import React, { useState } from "react";
import Image from "next/image";
import { sanitize } from "@/app/lib/sanitize";
import { DEFAULT_BLUR_PLACEHOLDER, type ImageLoadingState } from "@/app/lib/imageUtils";

interface NFTCardProps {
  id: string;
  title: string;
  thumbnail: string;
  viralityScore: number;
  mintStatus: "pending" | "minted" | "listed" | "failed";
  onAction?: (id: string) => void;
}

export default function NFTCard({ id, title, thumbnail, viralityScore, mintStatus, onAction }: NFTCardProps) {
  const [imageState, setImageState] = useState<ImageLoadingState>('loading');

  const handleImageLoad = () => {
    setImageState('loaded');
  };

  const handleImageError = () => {
    setImageState('error');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-400";
      case "minted":
        return "bg-green-500/20 text-green-400";
      case "listed":
        return "bg-blue-500/20 text-blue-400";
      case "failed":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Mint";
      case "minted":
        return "List";
      case "listed":
        return "View";
      case "failed":
        return "Retry";
      default:
        return "View";
    }
  };

  return (
    <div className="bg-input border border-white/10 rounded-[20px] overflow-hidden contain-layout-style hover:border-brand/50 transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video w-full relative">
        <Image
          src={thumbnail}
          alt={sanitize(title)}
          fill
          className={`object-cover transition-all duration-300 ${
            imageState === 'loaded' ? 'opacity-100' : 'opacity-80 blur-sm'
          }`}
          placeholder="blur"
          blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
          onLoad={handleImageLoad}
          onError={handleImageError}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {imageState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs text-white/50">Failed to load</p>
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(mintStatus)}`}>
            {mintStatus}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-white font-bold text-[14px] truncate">{sanitize(title)}</h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-muted text-[12px]">Virality: {viralityScore}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => onAction?.(id)}
          className="w-full bg-brand hover:bg-brand-hover text-black py-2.5 rounded-xl font-bold text-[13px] transition-all active:scale-[0.98]"
        >
          {getActionLabel(mintStatus)}
        </button>
      </div>
    </div>
  );
}
