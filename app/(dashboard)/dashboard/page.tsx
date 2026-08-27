/**
 * Dashboard page — Server Component.
 *
 * Fetches stats server-side so the HTML that reaches the browser already
 * contains real data — no loading spinner on first paint for authenticated
 * users. The client island (DashboardClient) hydrates the Zustand store with
 * this data on mount, so interactive features (SSE streaming, retry) work
 * normally after hydration.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardPageHeader from "./DashboardPageHeader";
import DashboardClient from "./DashboardClient";
import {
  fetchDashboardData,
  type DashboardData,
} from "@/app/lib/serverData";

// Force dynamic rendering — dashboard data is per-user and must not be
// shared between requests via static cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — ClipCash",
  description:
    "Your ClipCash creator dashboard. Track earnings, clips posted, active platforms, and recent projects at a glance.",
  openGraph: {
    title: "Dashboard — ClipCash",
    description:
      "Your ClipCash creator dashboard. Track earnings, clips, and platform performance.",
    url: "https://clipcash.ai/dashboard",
  },
  robots: {
    // Authenticated page — keep out of search indexes.
    index: false,
    follow: false,
  },
};

export default async function DashboardPage() {
  // Parallel data fetch alongside page render.
  // Unauthenticated users are already redirected by layout.tsx, so null here
  // means the API call itself failed — DashboardClient handles that gracefully.
  const initialData: DashboardData | null = await fetchDashboardData();

  return (
    <div className="px-4 sm:px-6 lg:px-10 xl:px-16 py-10 min-w-0">
      {/* Static header rendered as HTML — zero JS needed */}
      <DashboardPageHeader />

      {/* Client island — seeds Zustand store with server data on hydration */}
      <Suspense fallback={null}>
        <DashboardClient initialData={initialData} />
      </Suspense>
    </div>
  );
}
