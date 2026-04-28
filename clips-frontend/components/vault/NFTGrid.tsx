"use client";

import React, { useMemo, useState } from "react";
import NFTCard from "./NFTCard";
import { Search } from "lucide-react";
import { useDebounce } from "@/app/lib/useDebounce";

interface NFTGridProps {
  filter: "queue" | "minted" | "history";
}

interface NFTItem {
  id: string;
  title: string;
  thumbnail: string;
  floorPrice: number;
  currentValue: number;
  status: "ready_to_mint" | "queue" | "minted";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  mintedDate?: string;
  listedDate?: string;
}

// Mock data for different filters
const mockNFTData = {
  queue: [
    {
      id: "nft-1",
      title: "Legendary Gaming Moment #1",
      thumbnail: "https://images.unsplash.com/photo-1538481527238-41cbcecf2c4d?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 2.5,
      currentValue: 3.8,
      status: "ready_to_mint" as const,
      rarity: "legendary" as const,
    },
    {
      id: "nft-2",
      title: "Epic Gameplay Highlight",
      thumbnail: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 1.2,
      currentValue: 1.5,
      status: "queue" as const,
      rarity: "epic" as const,
    },
    {
      id: "nft-3",
      title: "Rare Streaming Moment",
      thumbnail: "https://images.unsplash.com/photo-1560070165-7474185a6ca0?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.8,
      currentValue: 1.1,
      status: "queue" as const,
      rarity: "rare" as const,
    },
    {
      id: "nft-4",
      title: "Uncommon Clip Series #4",
      thumbnail: "https://images.unsplash.com/photo-1552395784-5dd1b0e28326?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.5,
      currentValue: 0.6,
      status: "queue" as const,
      rarity: "common" as const,
    },
    {
      id: "nft-5",
      title: "Common Daily Moment",
      thumbnail: "https://images.unsplash.com/photo-1535016120754-881642120dd7?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.2,
      currentValue: 0.25,
      status: "queue" as const,
      rarity: "common" as const,
    },
    {
      id: "nft-6",
      title: "Another Gaming Highlight",
      thumbnail: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 1.5,
      currentValue: 1.8,
      status: "queue" as const,
      rarity: "epic" as const,
    },
  ],
  minted: [
    {
      id: "nft-7",
      title: "Viral Clip #1 Listed",
      thumbnail: "https://images.unsplash.com/photo-1538481527238-41cbjecf2c4d?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 3.0,
      currentValue: 4.2,
      status: "minted" as const,
      rarity: "legendary" as const,
      listedDate: "2 days ago",
    },
    {
      id: "nft-8",
      title: "Epic Stream Moment Listed",
      thumbnail: "https://images.unsplash.com/photo-1557672172-298e090d0f80?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 1.8,
      currentValue: 2.5,
      status: "minted" as const,
      rarity: "epic" as const,
      listedDate: "5 days ago",
    },
    {
      id: "nft-9",
      title: "Rare Collectible Listed",
      thumbnail: "https://images.unsplash.com/photo-1552395784-5dd1b0e28326?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 1.2,
      currentValue: 1.6,
      status: "minted" as const,
      rarity: "rare" as const,
      listedDate: "1 week ago",
    },
    {
      id: "nft-10",
      title: "Uncommon Listed #2",
      thumbnail: "https://images.unsplash.com/photo-1545291026-86e38941b830?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.6,
      currentValue: 0.8,
      status: "minted" as const,
      rarity: "uncommon" as const,
      listedDate: "10 days ago",
    },
    {
      id: "nft-11",
      title: "Common Clip Listed",
      thumbnail: "https://images.unsplash.com/photo-1552372052-37b94b71b6e2?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.3,
      currentValue: 0.4,
      status: "minted" as const,
      rarity: "common" as const,
      listedDate: "2 weeks ago",
    },
    {
      id: "nft-12",
      title: "Popular Stream Moment",
      thumbnail: "https://images.unsplash.com/photo-1551431009-381d36ac3a09?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 2.2,
      currentValue: 3.1,
      status: "minted" as const,
      rarity: "epic" as const,
      listedDate: "3 weeks ago",
    },
  ],
  history: [
    {
      id: "nft-13",
      title: "First Minted NFT",
      thumbnail: "https://images.unsplash.com/photo-1538481527238-41cbjecf2c4d?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 2.0,
      currentValue: 5.5,
      status: "minted" as const,
      rarity: "legendary" as const,
      mintedDate: "Jan 15, 2024",
    },
    {
      id: "nft-14",
      title: "Historic Clip #2",
      thumbnail: "https://images.unsplash.com/photo-1552395784-5dd1b0e28326?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.8,
      currentValue: 2.1,
      status: "minted" as const,
      rarity: "epic" as const,
      mintedDate: "Jan 20, 2024",
    },
    {
      id: "nft-15",
      title: "Archived Collection #1",
      thumbnail: "https://images.unsplash.com/photo-1551430782-5ea266b2acce?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.5,
      currentValue: 1.8,
      status: "minted" as const,
      rarity: "rare" as const,
      mintedDate: "Jan 25, 2024",
    },
    {
      id: "nft-16",
      title: "Old Series Uncommon",
      thumbnail: "https://images.unsplash.com/photo-1545291026-86e38941b830?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.2,
      currentValue: 0.7,
      status: "minted" as const,
      rarity: "uncommon" as const,
      mintedDate: "Feb 01, 2024",
    },
    {
      id: "nft-17",
      title: "Historical Common",
      thumbnail: "https://images.unsplash.com/photo-1552372052-37b94b71b6e2?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.1,
      currentValue: 0.5,
      status: "minted" as const,
      rarity: "common" as const,
      mintedDate: "Feb 05, 2024",
    },
    {
      id: "nft-18",
      title: "Vintage Gaming Moment",
      thumbnail: "https://images.unsplash.com/photo-1552395784-5dd1b0e28326?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 1.0,
      currentValue: 3.2,
      status: "minted" as const,
      rarity: "epic" as const,
      mintedDate: "Feb 10, 2024",
    },
    {
      id: "nft-19",
      title: "Archive Collection #2",
      thumbnail: "https://images.unsplash.com/photo-1557672172-298e090d0f80?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.3,
      currentValue: 1.2,
      status: "minted" as const,
      rarity: "rare" as const,
      mintedDate: "Feb 15, 2024",
    },
    {
      id: "nft-20",
      title: "Early Series #8",
      thumbnail: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=300&h=300",
      floorPrice: 0.6,
      currentValue: 1.9,
      status: "minted" as const,
      rarity: "epic" as const,
      mintedDate: "Feb 20, 2024",
    },
  ],
};

export default function NFTGrid({ filter }: NFTGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredNFTs = useMemo(() => {
    const baseNFTs = mockNFTData[filter] || [];
    if (!debouncedSearch) return baseNFTs;
    
    return baseNFTs.filter(nft => 
      nft.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [filter, debouncedSearch]);

  const getFilterInfo = () => {
    switch (filter) {
      case "queue":
        return { title: "Pending Mint", description: "NFTs waiting to be minted to blockchain" };
      case "minted":
        return { title: "Listed NFTs", description: "NFTs currently available for sale" };
      case "history":
        return { title: "Minting History", description: "All previously minted NFTs" };
    }
  };

  const filterInfo = getFilterInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-extrabold text-white tracking-tight">{filterInfo.title}</h2>
          <p className="text-[14px] text-muted mt-1">{filterInfo.description}</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-input border border-border rounded-xl">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search NFTs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-white text-[13px] placeholder-muted-foreground outline-none w-40"
          />
        </div>
      </div>

      {/* NFT Grid */}
      {filteredNFTs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNFTs.map((nft: NFTItem) => (
            <NFTCard
              key={nft.id}
              id={nft.id}
              title={nft.title}
              thumbnail={nft.thumbnail}
              floorPrice={nft.floorPrice}
              currentValue={nft.currentValue}
              status={nft.status}
              rarity={nft.rarity}
              mintedDate={nft.mintedDate}
              listedDate={nft.listedDate}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-[16px] font-bold text-white mb-2">
              {debouncedSearch ? "No Search Results" : "No NFTs Found"}
            </h3>
            <p className="text-[14px] text-muted max-w-xs">
              {debouncedSearch 
                ? `We couldn't find any NFTs matching "${debouncedSearch}"`
                : (
                  <>
                    {filter === "pending" && "Create and configure new NFTs to get started."}
                    {filter === "listed" && "No NFTs are currently listed for sale."}
                    {filter === "history" && "No minting history yet."}
                  </>
                )
              }
            </p>
          </div>
        </div>
      )}

      {/* Results Count */}
      {filteredNFTs.length > 0 && (
        <div className="text-center pt-4 border-t border-border">
          <p className="text-[13px] text-muted-foreground">
            Showing <span className="font-bold text-white">{filteredNFTs.length}</span> NFTs
          </p>
        </div>
      )}
    </div>
  );
}
