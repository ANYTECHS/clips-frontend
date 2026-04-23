"use client";

import React, { useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import VaultSidebar from "@/components/vault/VaultSidebar";
import NFTGrid from "@/components/vault/NFTGrid";
import MintConfigForm from "@/components/projects/MintConfigForm";
import { ChevronRight } from "lucide-react";

export default function VaultPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"pending" | "listed" | "history">("pending");
  const [showMintPanel, setShowMintPanel] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Radial Glows */}
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />
      
      {/* Sidebar Backdrop Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Navigation */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-8 max-w-full mx-auto w-full">
          {/* Page Header */}
          <div className="px-6 sm:px-8 pt-2">
            <div className="flex flex-col gap-2">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight">NFT Vault</h1>
              <p className="text-[14px] text-[#8e9895]">Manage your minted NFTs and create new collections</p>
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
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="w-full px-4 py-3 bg-[#0B100E] border border-white/10 rounded-xl text-white text-[14px] font-bold focus:outline-none focus:border-brand/50 transition-colors"
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
                <NFTGrid filter={activeFilter} />
              </div>

              {/* Mint Configuration Panel (Desktop) */}
              <div className="hidden lg:block w-96 shrink-0">
                <div className="sticky top-20 bg-[#0B100E] border border-white/10 rounded-[20px] p-6">
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
                      <MintConfigForm />
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
                  <div className="mt-6 bg-[#0B100E] border border-white/10 rounded-[20px] p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h3 className="text-[18px] font-extrabold text-white mb-6">Mint Configuration</h3>
                    <MintConfigForm />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
