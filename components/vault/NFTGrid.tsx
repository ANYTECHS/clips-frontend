import React from "react";
import NFTCard from "./NFTCard";
import Skeleton from "@/components/ui/Skeleton";

interface NFTGridProps {
  filter: "pending" | "listed" | "history";
  loading: boolean;
}

interface NFTData {
  id: string;
  title: string;
  thumbnail: string;
  viralityScore: number;
  mintStatus: "pending" | "minted" | "listed" | "failed";
}

// Mock data for development - replace with actual API calls
const mockNFTs: Record<string, NFTData[]> = {
  pending: [
    {
      id: "1",
      title: "Epic Gaming Moment #1",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400",
      viralityScore: 85,
      mintStatus: "pending",
    },
    {
      id: "2",
      title: "Cooking Tutorial Highlight",
      thumbnail: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400",
      viralityScore: 72,
      mintStatus: "pending",
    },
  ],
  listed: [
    {
      id: "3",
      title: "Tech Review Compilation",
      thumbnail: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=400",
      viralityScore: 94,
      mintStatus: "listed",
    },
    {
      id: "4",
      title: "Music Video Clip",
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
      viralityScore: 88,
      mintStatus: "listed",
    },
  ],
  history: [
    {
      id: "5",
      title: "Sports Highlight Reel",
      thumbnail: "https://images.unsplash.com/photo-1461896836934- voices-1?w=400",
      viralityScore: 91,
      mintStatus: "minted",
    },
    {
      id: "6",
      title: "Travel Vlog Moment",
      thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400",
      viralityScore: 76,
      mintStatus: "minted",
    },
  ],
};

export default function NFTGrid({ filter, loading }: NFTGridProps) {
  const handleCardAction = (id: string) => {
    // Implement actual action logic (mint, list, view, etc.)
  };

  // Loading state - show skeletons
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-input border border-white/10 rounded-[20px] overflow-hidden">
            <Skeleton className="aspect-video w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const nfts = mockNFTs[filter] || [];

  // Empty state
  if (nfts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-24 h-24 mb-4 rounded-full bg-white/5 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-white font-bold text-[18px] mb-2">No NFTs found</h3>
        <p className="text-muted text-[14px] text-center max-w-sm">
          {filter === "pending" && "You have no clips pending to be minted."}
          {filter === "listed" && "You haven't listed any NFTs for sale yet."}
          {filter === "history" && "Your minting history is empty."}
        </p>
      </div>
    );
  }

  // Grid of NFT cards
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {nfts.map((nft) => (
        <NFTCard
          key={nft.id}
          id={nft.id}
          title={nft.title}
          thumbnail={nft.thumbnail}
          viralityScore={nft.viralityScore}
          mintStatus={nft.mintStatus}
          onAction={handleCardAction}
        />
      ))}
    </div>
  );
}
