"use client";

import React, { useMemo, useState } from "react";
import NFTCard from "./NFTCard";
import VaultCardSkeleton from "./VaultCardSkeleton";
import { Search } from "lucide-react";
import { useDebounce } from "@/app/lib/useDebounce";

interface NFTGridProps {
  filter: "pending" | "listed" | "history";
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

// ... mock data ...

export default function NFTGrid({ filter, loading = false }: NFTGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredNFTs = useMemo(() => {
    const filterKey = filter === "pending" ? "queue" : filter === "listed" ? "minted" : "history";
    const baseNFTs = mockNFTData[filterKey] || [];
    if (!debouncedSearch) return baseNFTs;
    
    return baseNFTs.filter(nft => 
      nft.title.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [filter, debouncedSearch]);

  const getFilterInfo = () => {
    switch (filter) {
      case "pending":
        return { title: "Pending Mint", description: "NFTs waiting to be minted to blockchain" };
      case "listed":
        return { title: "Listed NFTs", description: "NFTs currently available for sale" };
      case "history":
        return { title: "Minting History", description: "All previously minted NFTs" };
    }
  };

  const filterInfo = getFilterInfo();

  return (
    <div className="space-y-6" aria-busy={loading}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-extrabold text-white tracking-tight">{filterInfo.title}</h2>
          <p className="text-[14px] text-muted mt-1">{filterInfo.description}</p>
        </div>
        {!loading && (
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
        )}
      </div>

      {/* NFT Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <VaultCardSkeleton key={`v-skeleton-${i}`} />
          ))}
        </div>
      ) : filteredNFTs.length > 0 ? (
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
                    {filter === "queue" && "Create and configure new NFTs to get started."}
                    {filter === "minted" && "No NFTs are currently listed for sale."}
                    {filter === "history" && "No minting history yet."}
                  </>
                )
              }
            </p>
          </div>
        </div>
      )}

      {/* Results Count */}
      {!loading && filteredNFTs.length > 0 && (
        <div className="text-center pt-4 border-t border-border">
          <p className="text-[13px] text-muted-foreground">
            Showing <span className="font-bold text-white">{filteredNFTs.length}</span> NFTs
          </p>
        </div>
      )}
    </div>
  );
}

