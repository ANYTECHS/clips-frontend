"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import VaultSidebar from "@/components/vault/VaultSidebar";
import NFTGrid from "@/components/vault/NFTGrid";
import { ChevronRight } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/naming-convention
const MintConfigForm = dynamic(() => import("@/components/projects/MintConfigForm"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-white/5 rounded-xl" />
      <div className="h-20 bg-white/5 rounded-xl" />
      <div className="h-10 bg-white/5 rounded-xl" />
      <div className="h-10 bg-white/5 rounded-xl" />
    </div>
  ),
});

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
    try {
      // 1. Get user's public key from freighter
      // @ts-expect-error - Freighter adds this to window
      const freighter = window.freighter;
      if (!freighter) throw new Error("Freighter wallet is not installed.");
      
      const publicKey = await freighter.getPublicKey();
      if (!publicKey) throw new Error("Could not get public key from wallet.");

      // 2. Ask backend to build the transaction
      const buildRes = await fetch("/api/nft/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, publicKey })
      });
      if (!buildRes.ok) {
        const errorData = await buildRes.json();
        throw new Error(errorData.error || "Failed to build transaction");
      }
      const { xdr, networkPassphrase } = await buildRes.json();

      // 3. Sign the transaction
      const signedXdr = await freighter.signTransaction(xdr, {
        network: "TESTNET", // or use networkPassphrase to derive it
        accountToSign: publicKey
      });
      if (!signedXdr) throw new Error("Failed to sign transaction.");

      // 4. Submit the transaction back to the backend
      const submitRes = await fetch("/api/nft/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, signedXdr })
      });
      if (!submitRes.ok) {
        const errorData = await submitRes.json();
        throw new Error(errorData.error || "Failed to submit transaction");
      }
      
      const result = await submitRes.json();
      return result;
    } catch (error) {
      throw error;
    }
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
