"use client";

import React, { useState, memo } from "react";
import Image from 'next/image';
import { 
  ExternalLink,
  Zap,
  TrendingUp,
  Clock,
  Play,
  Sparkles,
  Timer
} from "lucide-react";

interface NFTCardProps {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl?: string;
  duration?: string;
  aiScore?: number;
  floorPrice?: number;
  currentValue?: number;
  status: "ready_to_mint" | "queue" | "minted";
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  mintedDate?: string;
  listedDate?: string;
  queuePosition?: number;
}

const NFTCard = memo(function NFTCard({
  id,
  title,
  thumbnail,
  videoUrl,
  duration,
  aiScore,
  floorPrice,
  currentValue,
  status,
  rarity = "common",
  mintedDate,
  listedDate,
  queuePosition,
}: NFTCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const getRarityStyle = (r: string) => {
    switch (r) {
      case "legendary":
        return "bg-gradient-to-r from-legendary-from to-legendary-to text-black";
      case "epic":
        return "bg-gradient-to-r from-epic-from to-epic-to text-white";
      case "rare":
        return "bg-gradient-to-r from-brand to-brand/80 text-black";
      case "uncommon":
        return "bg-uncommon text-white";
      default:
        return "bg-muted-foreground text-white";
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "ready_to_mint":
        return { color: "bg-brand/20 text-brand border-brand/30", label: "Ready to Mint", icon: Sparkles };
      case "queue":
        return { color: "bg-warning/20 text-warning border-warning/30", label: `Queue #${queuePosition || 1}`, icon: Timer };
      case "minted":
        return { color: "bg-uncommon/20 text-uncommon border-uncommon/30", label: "Minted", icon: Zap };
      default:
        return { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: "Unknown", icon: Timer };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;
  const priceChange = floorPrice && currentValue ? ((currentValue - floorPrice) / floorPrice) * 100 : 0;

  return (
    <div 
      className="group relative bg-surface border border-border hover:border-brand rounded-[20px] overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-brand/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-square overflow-hidden bg-background">
        {videoUrl && isHovered ? (
          <video 
            src={videoUrl}
            autoPlay
            muted
            loop
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onMouseEnter={() => setIsPlaying(true)}
            onMouseLeave={() => setIsPlaying(false)}
          />
        ) : (
          <Image
            src={thumbnail}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}

        {/* AI Score Badge (Top Left) */}
        {aiScore !== undefined && (
          <div className="absolute top-3 left-3 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-brand/90 to-brand/70 text-black font-bold text-[10px] tracking-wider backdrop-blur-md flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI: {aiScore}
          </div>
        )}

        {/* Status Badge (Top Right) */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold backdrop-blur-md ${badge.color}`}>
          <BadgeIcon className="w-3 h-3" />
          {badge.label}
        </div>

        {/* Duration Badge (Bottom Left) */}
        {duration && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded-lg bg-black/60 text-white font-medium text-[10px] backdrop-blur-md flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {duration}
          </div>
        )}

        {/* Play Button Overlay (Center) */}
        {videoUrl && (
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
            <div className="w-12 h-12 rounded-full bg-brand/90 text-black flex items-center justify-center backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play className="w-5 h-5 ml-0.5" />
            </div>
          </div>
        )}

        {/* Action Overlay on Hover (for minted status) */}
        {status === "minted" && (
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
            <button className="bg-brand hover:bg-brand-hover text-black px-4 py-2.5 rounded-lg font-bold text-[12px] flex items-center gap-2 transition-all active:scale-[0.98]">
              <ExternalLink className="w-4 h-4" />
              View NFT
            </button>
          </div>
        )}

        {/* Mint Action Overlay (for ready_to_mint status) */}
        {status === "ready_to_mint" && (
          <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}>
            <button className="bg-brand hover:bg-brand-hover text-black px-4 py-2.5 rounded-lg font-bold text-[12px] flex items-center gap-2 transition-all active:scale-[0.98]">
              <Sparkles className="w-4 h-4" />
              Mint Now
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="min-h-10">
          <h4 className="text-[14px] font-bold text-white line-clamp-2 group-hover:text-brand transition-colors">{title}</h4>
        </div>

        {/* Rarity Badge */}
        {rarity && (
          <div className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] tracking-widest uppercase ${getRarityStyle(rarity)}`}>
            {rarity}
          </div>
        )}

        {/* Price Info (only for minted status) */}
        {status === "minted" && floorPrice && currentValue && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted uppercase tracking-wider font-bold">Current Value</span>
              <span className={`text-[12px] font-bold ${priceChange >= 0 ? "text-brand" : "text-error"}`}>
                {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[18px] font-black text-white">{currentValue.toFixed(2)}</span>
              <span className="text-[12px] text-muted">ETH</span>
            </div>
          </div>
        )}

        {/* Floor Price Comparison (only for minted status) */}
        {status === "minted" && floorPrice && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Floor: {floorPrice.toFixed(2)} ETH</span>
            <span className="text-[11px] text-muted-foreground">{mintedDate || listedDate || "N/A"}</span>
          </div>
        )}

        {/* Queue Info (only for queue status) */}
        {status === "queue" && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Position in Queue</span>
            <span className="text-[11px] font-bold text-warning">#{queuePosition || 1}</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default NFTCard;
