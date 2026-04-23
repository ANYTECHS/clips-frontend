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
        return "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black";
      case "epic":
        return "bg-gradient-to-r from-[#9D4EDD] to-[#7209B7] text-white";
      case "rare":
        return "bg-gradient-to-r from-[#00E58F] to-[#00C46E] text-black";
      case "uncommon":
        return "bg-[#3A86FF] text-white";
      default:
        return "bg-[#6B7D72] text-white";
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "pending":
        return { color: "bg-[#FACC15]/20 text-[#FACC15] border-[#FACC15]/30", label: "Pending Mint", icon: Clock };
      case "listed":
        return { color: "bg-[#00E58F]/20 text-[#00E58F] border-[#00E58F]/30", label: "Listed", icon: TrendingUp };
      case "minted":
        return { color: "bg-[#3A86FF]/20 text-[#3A86FF] border-[#3A86FF]/30", label: "Minted", icon: Zap };
    }
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;
  const priceChange = ((currentValue - floorPrice) / floorPrice) * 100;

  return (
    <div 
      className="group relative bg-[#0B100E] border border-white/5 hover:border-white/20 rounded-[20px] overflow-hidden transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail Area */}
      <div className="relative aspect-square overflow-hidden bg-[#050505]">
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
            <span className="text-[11px] text-[#8e9895] uppercase tracking-wider font-bold">Current Value</span>
            <span className={`text-[12px] font-bold ${priceChange >= 0 ? "text-[#00E58F]" : "text-[#EF4444]"}`}>
              {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[18px] font-black text-white">{currentValue.toFixed(2)}</span>
            <span className="text-[12px] text-[#8e9895]">ETH</span>
          </div>
        </div>

        {/* Floor Price Comparison */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[11px] text-[#5A6F65]">Floor: {floorPrice.toFixed(2)} ETH</span>
          <span className="text-[11px] text-[#5A6F65]">{mintedDate || listedDate || "N/A"}</span>
        </div>
      </div>
    </div>
  );
});

export default NFTCard;
