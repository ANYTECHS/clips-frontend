"use client";

import React, { useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ActivityFeed from "@/components/wallet/ActivityFeed";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { Loader2, AlertCircle, Activity } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

export default function ActivityPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { publicKey, status, network, error } = useAutoStellarWallet();

  const networkUpper = network === "testnet" ? "TESTNET" : "PUBLIC";

  return (
    <div className="flex min-h-screen bg-background text-white font-sans">
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-6 max-w-[1200px] mx-auto w-full">
          {/* Page header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-[22px] font-black text-white">Activity Feed</h1>
              <p className="text-[12px] text-muted">
                Complete transaction history for your Stellar wallet
              </p>
            </div>
          </div>

          {/* Wallet not found state */}
          {status === "idle" && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto mb-4">
                <Activity className="w-7 h-7 text-muted" />
              </div>
              <h2 className="text-[16px] font-bold text-white mb-2">No Wallet Connected</h2>
              <p className="text-muted text-[13px] max-w-md mx-auto">
                Connect a Stellar wallet to view your transaction activity and payment history.
              </p>
            </div>
          )}

          {/* Loading state */}
          {status === "loading" && (
            <div className="bg-surface border border-border rounded-[24px] p-5 sm:p-6 space-y-6">
              {/* Header Skeleton */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-6 rounded-lg" />
              </div>
              
              {/* Filter Chips Skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full animate-pulse" />
                <Skeleton className="h-7 w-12 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7.5 w-16 rounded-lg" />
              </div>

              {/* Transactions Skeleton List */}
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-hover/50">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && error && (
            <div className="flex items-start gap-3 bg-error/10 border border-error/30 rounded-xl px-5 py-4 max-w-lg">
              <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
              <div>
                <p className="text-error text-[13px] font-bold">Failed to load wallet</p>
                <p className="text-error/80 text-[12px] mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Activity Feed */}
          {status === "ready" && publicKey && (
            <div className="bg-surface border border-border rounded-[24px] p-5 sm:p-6">
              <ActivityFeed publicKey={publicKey} network={networkUpper} pageSize={20} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
