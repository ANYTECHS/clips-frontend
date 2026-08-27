/**
 * Analytics page — Server Component.
 *
 * Reads filter values from searchParams and fetches analytics data
 * server-side so the first paint includes real numbers. The
 * AnalyticsPageClient island takes over filter interactivity after hydration.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import AnalyticsPageClient from "./AnalyticsPageClient";
import { fetchAnalyticsData, type AnalyticsData } from "@/app/lib/serverData";

export const dynamic = "force-dynamic";

interface SearchParams {
  range?: string;
  platform?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { range = "30d", platform = "all" } = await searchParams;

  const rangeLabel: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "all": "All Time",
  };

  const platformLabel = platform !== "all" ? ` · ${platform}` : "";
  const rangeDisplay  = rangeLabel[range] ?? "Last 30 Days";
  const title         = `Clip Analytics (${rangeDisplay}${platformLabel}) — ClipCash`;

  return {
    title,
    description:
      "Deep-dive into your ClipCash clip performance — total views, watch time, engagement rates, and platform breakdowns.",
    openGraph: {
      title,
      description:
        "Clip analytics, engagement rates, and platform performance breakdowns for your ClipCash account.",
      url: `https://clipcash.ai/analytics`,
    },
    robots: { index: false, follow: false },
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { range = "30d", platform = "all" } = await searchParams;

  // Derive startDate from the range string the same way the client does.
  const startDate =
    range !== "all"
      ? new Date(Date.now() - Number(range.replace("d", "")) * 86_400_000)
          .toISOString()
          .split("T")[0]
      : undefined;

  const initialData: AnalyticsData | null = await fetchAnalyticsData(
    startDate,
    platform !== "all" ? platform : undefined,
  );

  return (
    <Suspense fallback={null}>
      <AnalyticsPageClient
        initialData={initialData}
        initialRange={range}
        initialPlatform={platform}
      />
    </Suspense>
  );
}
