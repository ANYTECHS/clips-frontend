"use client";

import React, { useState, useEffect } from "react";
import VaultSidebar from "@/components/vault/VaultSidebar";
import NFTGrid from "@/components/vault/NFTGrid";
import MintConfigForm from "@/components/projects/MintConfigForm";
import { MockApi } from "@/app/lib/mockApi";
import { ChevronRight } from "lucide-react";

export default function VaultPage() {
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"pending" | "listed" | "history">("pending");
  const [showMintPanel, setShowMintPanel] = useState(false);

  // Simulate loading delay
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleMintSubmit = async (data: {
    collectionName: string;
    description: string;
    creatorRoyalty: string;
    listingPrice: string;
  }) => {
    // Call the actual minting API
    const result = await MockApi.mintCollection(data);
    console.log("Minting successful:", result);
    // You could add additional logic here like showing a toast notification
    // or updating the NFT grid with the new collection
    return result;
  };

  return (
    <div className="dashboard-main space-y-8 max-w-full mx-auto w-full">
          {/* Page Header */}
          <div className="px-6 sm:px-8 pt-2">
            <div className="flex flex-col gap-2">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight">NFT Vault</h1>
              <p className="text-[14px] text-muted">Manage your minted NFTs and create new collections</p>
            </div>
          </div>

          {/* Main Layout: Sidebar + Grid + Panel */}
          <div className="flex gap-6 px-6 sm:px-8 pb-8">
            {/* Vault Filters Sidebar */}
            <div className="hidden lg:block w-64 shrink-0">
              <VaultSidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            </div>

            {/* Mobile Filter Dropdown */}
            <div className="lg:hidden w-full max-w-xs">
              <select 
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as "pending" | "listed" | "history")}
                className="w-full px-4 py-3 bg-input border border-white/10 rounded-xl text-white text-[14px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus:border-brand/50 transition-colors"
              >
                <option value="pending">Pending Mint</option>
                <option value="listed">Listed</option>
                <option value="history">History</option>
              </select>
            </div>

            {/* Grid + Right Panel */}
            <div className="flex-1 min-w-0 flex flex-col lg:flex-row gap-6">
              {/* NFT Grid */}
              <div className="flex-1 min-w-0">
                <NFTGrid filter={activeFilter} loading={loading} />
              </div>

              {/* Mint Configuration Panel (Desktop) */}
              <div className="hidden lg:block w-96 shrink-0">
                <div className="sticky top-20 bg-input border border-white/10 rounded-[20px] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[18px] font-extrabold text-white">Mint Configuration</h3>
                    <button
                      onClick={() => setShowMintPanel(!showMintPanel)}
                      className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <ChevronRight className={`w-5 h-5 text-brand transition-transform duration-300 ${showMintPanel ? "rotate-90" : ""}`} />
                    </button>
                  </div>

                  {showMintPanel && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <MintConfigForm onSubmit={handleMintSubmit} />
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Mint Button */}
              <div className="lg:hidden w-full">
                <button
                  onClick={() => setShowMintPanel(!showMintPanel)}
                  className="w-full bg-brand hover:bg-brand-hover text-black py-3 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98]"
                >
                  {showMintPanel ? "Hide Configuration" : "Configure Mint"}
                </button>

                {showMintPanel && (
                  <div className="mt-6 bg-input border border-white/10 rounded-[20px] p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="text-[18px] font-extrabold text-white mb-6">Mint Configuration</h3>
                    <MintConfigForm onSubmit={handleMintSubmit} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
  );
}
