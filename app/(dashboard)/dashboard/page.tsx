import Link from "next/link";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import StatCard from "@/components/dashboard/StatCard";
import AIInsightCard from "@/components/dashboard/AIInsightCard";
import ProjectCard from "@/components/dashboard/ProjectCard";
import EarningsSummaryCards from "@/components/dashboard/EarningsSummaryCards";
import WalletInfoCard from "@/components/dashboard/WalletInfoCard";
import Skeleton from "@/components/ui/Skeleton";
import { DollarSign, Video, Globe, AlertCircle } from "lucide-react";
import DashboardPageHeader from "./DashboardPageHeader";
import { getDashboardDataServer } from "@/app/lib/dashboardService";

// Lazy-load heavy client components for better performance
const RevenueChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface border border-border rounded-[24px] p-8 h-[300px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

const SendPaymentForm = dynamic(() => import("@/components/SendPaymentForm"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface border border-border rounded-[24px] p-8 h-[300px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

const WalletHealthCard = dynamic(() => import("@/components/wallet/WalletHealthCard"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface border border-border rounded-[24px] p-8 h-[200px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

const PlatformDistribution = dynamic(() => import("@/components/dashboard/PlatformDistribution"), {
  ssr: false,
  loading: () => (
    <div className="bg-surface border border-border rounded-[24px] p-6 h-[300px] flex items-center justify-center">
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

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

function DashboardSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardDataServer();
  const error = 'error' in data ? new Error(data.error) : null;
  const stats = !error && !('error' in data) ? data.stats : null;
  const recentProjects = !error && !('error' in data) ? data.recentProjects : [];

  if (error) {
    return (
      <div className="bg-surface border border-error/50 rounded-[24px] p-8 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-error" />
        <div className="space-y-1">
          <h3 className="text-xl font-bold">Failed to load dashboard data</h3>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
        <Link
          href="/dashboard"
          className="mt-4 px-6 py-2 bg-error/10 hover:bg-error/20 text-error border border-error/20 rounded-xl transition-colors font-semibold"
        >
          Retry
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats ? (
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
              No data yet &mdash; upload your first video to get started
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
          <WalletHealthCard />
        </div>
      </div>

      <AIInsightCard />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-extrabold text-white tracking-tight">Recent Projects</h3>
          <Link href="/projects" className="text-[14px] font-bold text-brand hover:underline">View All</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
          {recentProjects.length === 0 ? (
            <div className="col-span-full">
              <p className="text-muted-foreground text-sm">No recent projects.</p>
            </div>
          ) : (
            recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                title={project.title}
                clipsCount={project.clipsGenerated}
                status={project.status}
                thumbnail={project.image ?? "/projects/thumb1.png"}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="dashboard-main space-y-8 max-w-[1400px] mx-auto w-full">
      <DashboardPageHeader />
      <Suspense fallback={<DashboardSkeletons />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
