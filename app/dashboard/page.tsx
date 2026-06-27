"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import PlatformDistribution from "@/components/dashboard/PlatformDistribution";
import AIInsightCard from "@/components/dashboard/AIInsightCard";
import ProjectCard from "@/components/dashboard/ProjectCard";
import EarningsSummaryCards from "@/components/dashboard/EarningsSummaryCards";
import SendPaymentForm from "@/components/SendPaymentForm";
import WalletInfoCard from "@/components/dashboard/WalletInfoCard";
import WalletHealthCard from "@/components/wallet/WalletHealthCard";
import Skeleton from "@/components/ui/Skeleton";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { useDashboardData } from "@/app/hooks/useDashboardData";
import { DollarSign, Video, Globe } from "lucide-react";

function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-[24px] p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <div className="flex items-end gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { publicKey } = useAutoStellarWallet();
  const { data, loading, error, retry } = useDashboardData();
  const stats = data?.stats;
  const recentProjects = data?.recentProjects ?? [];

  return (
    <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-8 max-w-[1400px] mx-auto w-full">
          {error ? (
            <div className="bg-surface border border-error/50 rounded-[24px] p-8 flex flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-error" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Failed to load dashboard data</h3>
                <p className="text-muted-foreground">{error.message}</p>
              </div>
              <button
                onClick={retry}
                className="mt-4 px-6 py-2 bg-error/10 hover:bg-error/20 text-error border border-error/20 rounded-xl transition-colors font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && !stats ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : stats ? (
              <>
                <StatCard
                  label="Total Earnings"
                  value={stats.earnings.total}
                  trend={stats.earnings.trendLabel}
                  isPositive={stats.earnings.trend >= 0}
                  icon={DollarSign}
                />
                <StatCard
                  label="Clips Posted"
                  value={String(stats.clips.total)}
                  trend={stats.clips.trendLabel}
                  isPositive={stats.clips.trend >= 0}
                  icon={Video}
                />
                <StatCard
                  label="Active Platforms"
                  value={String(stats.platforms.total)}
                  trend={stats.platforms.trendLabel}
                  isPositive={stats.platforms.trend >= 0}
                  hideTrendIcon={stats.platforms.trend === 0}
                  icon={Globe}
                />
              </>
            ) : null}
          </div>

          <WalletInfoCard />

          <div className="space-y-4">
            <h3 className="text-[18px] font-extrabold text-white tracking-tight">Earnings Summary</h3>
            <EarningsSummaryCards />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
            <div>
              <PlatformDistribution />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-[18px] font-extrabold text-[#ffffff] tracking-tight">Payments Hub</h3>
              <SendPaymentForm />
            </div>

            <div className="space-y-4 flex flex-col">
              <h3 className="text-[18px] font-extrabold text-[#ffffff] tracking-tight">Stellar Wallet Status</h3>
              <WalletHealthCard publicKey={publicKey} />
            </div>
          </div>

          <AIInsightCard />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-extrabold text-white tracking-tight">Recent Projects</h3>
              <Link href="/projects" className="text-[14px] font-bold text-brand hover:underline">View All</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
              {loading && recentProjects.length === 0
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={`project-skeleton-${i}`}
                      className="bg-surface border border-border rounded-[24px] p-5 flex items-center gap-5"
                    >
                      <Skeleton className="w-24 h-24 rounded-[18px] shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                : recentProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      title={project.title}
                      clipsCount={project.clipsGenerated}
                      status={project.status}
                      thumbnail={project.image ?? "/projects/thumb1.png"}
                    />
                  ))}
            </div>
          </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
