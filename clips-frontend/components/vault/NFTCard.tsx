"use client";

import React, { useState, memo } from "react";
import { 
  ExternalLink,
  Zap,
  TrendingUp,
  Clock
} from "lucide-react";

interface NFTCardProps {
  id: string;
  title: string;
  thumbnail: string;
  floorPrice: number;
  currentValue: number;
  status: "pending" | "listed" | "minted";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  mintedDate?: string;
  listedDate?: string;
}

const NFTCard = memo(function NFTCard({
  id,
  title,
  thumbnail,
  floorPrice,
  currentValue,
  status,
  rarity,
  mintedDate,
  listedDate,
}: NFTCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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
      case "pending":
        return { color: "bg-warning/20 text-warning border-warning/30", label: "Pending Mint", icon: Clock };
      case "listed":
        return { color: "bg-brand/20 text-brand border-brand/30", label: "Listed", icon: TrendingUp };
      case "minted":
        return { color: "bg-uncommon/20 text-uncommon border-uncommon/30", label: "Minted", icon: Zap };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;
  const priceChange = ((currentValue - floorPrice) / floorPrice) * 100;

  return (
    <div 
      className="group relative bg-surface border border-border hover:border-border rounded-[20px] overflow-hidden transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-square overflow-hidden bg-background">
        <img 
          src={thumbnail} 
          alt={title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* Rarity Badge (Top Left) */}
        <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg font-bold text-[10px] tracking-widest uppercase ${getRarityStyle(rarity)} backdrop-blur-md`}>
          {rarity}
        </div>

        {/* Status Badge (Top Right) */}
        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold backdrop-blur-md ${badge.color}`}>
          <BadgeIcon className="w-3 h-3" />
          {badge.label}
        </div>

        {/* Overlay on Hover */}
        <div className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}>
          <button className="bg-brand hover:bg-brand-hover text-black px-4 py-2.5 rounded-lg font-bold text-[12px] flex items-center gap-2 transition-all active:scale-[0.98]">
            <ExternalLink className="w-4 h-4" />
            View NFT
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="min-h-10">
          <h4 className="text-[14px] font-bold text-white line-clamp-2 group-hover:text-brand transition-colors">{title}</h4>
        </div>

        {/* Price Info */}
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

        {/* Floor Price Comparison */}
        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Floor: {floorPrice.toFixed(2)} ETH</span>
          <span className="text-[11px] text-muted-foreground">{mintedDate || listedDate || "N/A"}</span>
        </div>
      </div>
    </div>
  );
});

export default NFTCard;
