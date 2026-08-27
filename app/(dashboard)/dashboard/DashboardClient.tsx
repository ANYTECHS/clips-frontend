"use client";

/**
 * DashboardClient
 *
 * Client island for the dashboard page. Receives server-fetched initialData
 * and seeds the Zustand store so the first render is instant — no loading
 * spinner for users with JS enabled. If the server fetch failed (null), the
 * store's own fetchDashboard() fires as a fallback.
 *
 * Heavy components (charts, payment form, wallet) are lazy-loaded so they
 * don't block the initial HTML stream.
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import StatCard from "@/components/dashboard/StatCard";
import AIInsightCard from "@/components/dashboard/AIInsightCard";
import ProjectCard from "@/components/dashboard/ProjectCard";
import EarningsSummaryCards from "@/components/dashboard/EarningsSummaryCards";
import WalletInfoCard from "@/components/dashboard/WalletInfoCard";
import Skeleton from "@/components/ui/Skeleton";
import { useAutoStellarWallet } from "@/app/hooks/useAutoStellarWallet";
import { useDashboardData } from "@/app/hooks/useDashboardData";
import { useDashboardStore } from "@/app/store/dashboardStore";
import { DollarSign, Video, Globe, AlertCircle } from "lucide-react";
import type { DashboardData } from "@/app/lib/serverData";

// ─── Lazy-loaded heavy islands ────────────────────────────────────────────────

const skeletonBox = (h: string) => (
  <div className={`bg-surface border border-border rounded-[24px] p-8 ${h} flex items-center justify-center`}>
    <Skeleton className="w-full h-full" />
  </div>
);

const RevenueChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
  ssr: false,
  loading: () => skeletonBox("h-[300px]"),
});

const SendPaymentForm = dynamic(() => import("@/components/SendPaymentForm"), {
  ssr: false,
  loading: () => skeletonBox("h-[300px]"),
});

const WalletHealthCard = dynamic(() => import("@/components/wallet/WalletHealthCard"), {
  ssr: false,
  loading: () => skeletonBox("h-[200px]"),
});

const PlatformDistribution = dynamic(
  () => import("@/components/dashboard/PlatformDistribution"),
  { ssr: false, loading: () => skeletonBox("h-[300px] p-6") },
);

// ─── Skeleton for stat cards ──────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  /**
   * Data fetched server-side. When non-null it is seeded into the Zustand
   * store immediately, eliminating the initial loading state. When null
   * (auth failed or API error) the store fetches on its own as a fallback.
   */
  initialData: DashboardData | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const { publicKey } = useAutoStellarWallet();

  // Seed the store with server data before the first client render so
  // useDashboardData() returns non-null data immediately without a fetch.
  useEffect(() => {
    if (!initialData) return;
    useDashboardStore.setState({
      stats: initialData.stats,
      revenueTrend: initialData.revenueTrend,
      recentProjects: initialData.recentProjects,
      lastFetchedAt: Date.now(),
      loading: false,
      error: null,
    });
  // Run only once on mount — initialData is stable (serialised from server).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // enableStreaming: live stats update via SSE after hydration
  const { data, loading, error, retry } = useDashboardData({ enableStreaming: true });
  const stats = data?.stats;
  const recentProjects = data?.recentProjects ?? [];

  return (
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
          {/* ── Stat cards ── */}
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
            ) : (
              <div className="bg-surface border border-dashed border-white/10 rounded-[24px] p-10 flex flex-col items-center justify-center gap-3 text-center col-span-full">
                <Globe className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm max-w-xs">
                  No data yet — upload your first video to get started
                </p>
                <Link
                  href="/upload"
                  className="mt-1 px-5 py-2 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-colors text-sm font-semibold"
                >
                  Upload Video
                </Link>
              </div>
            )}
          </div>

          <WalletInfoCard />

          <div className="space-y-4">
            <h3 className="text-[18px] font-extrabold text-white tracking-tight">
              Earnings Summary
            </h3>
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
              <h3 className="text-[18px] font-extrabold text-white tracking-tight">
                Payments Hub
              </h3>
              <SendPaymentForm />
            </div>
            <div className="space-y-4 flex flex-col">
              <h3 className="text-[18px] font-extrabold text-white tracking-tight">
                Stellar Wallet Status
              </h3>
              <WalletHealthCard publicKey={publicKey} />
            </div>
          </div>

          <AIInsightCard />

          {/* ── Recent projects ── */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-extrabold text-white tracking-tight">
                Recent Projects
              </h3>
              <Link
                href="/projects"
                className="text-[14px] font-bold text-brand hover:underline"
              >
                View All
              </Link>
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
                      id={project.id}
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
  );
}
