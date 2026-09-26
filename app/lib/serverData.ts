/**
 * serverData.ts
 *
 * Server-side data fetching utilities for dashboard pages.
 *
 * Every function here:
 *  - Runs exclusively on the server (no `"use client"` directive in this file)
 *  - Calls `auth()` from Auth.js v5 to get the session — never `getServerSession`
 *  - Returns `null` when the user is unauthenticated so callers can redirect
 *  - Uses absolute internal URLs so it can be called from Server Components
 *    without relying on client-side `fetch("/api/...")` relative paths
 *  - Accepts `cache` / `next` options so page-level caching can be controlled
 *    per route segment
 *
 * Do NOT import Zustand stores or React hooks from this file.
 */

import { auth } from "@/app/lib/auth";
import type {
  DashboardStats,
  RevenuePoint,
  Project,
  UserProfile,
  EarningsBreakdownItem,
} from "@/app/store/types";
import type { BillingPlan } from "@/app/api/billing/plans/route";
import type { EarningTransaction, EarningsSummary, EarningsTrend } from "@/app/api/earnings/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an absolute URL for internal API routes.
 * Uses NEXTAUTH_URL (always set in production and CI) as the base, falling
 * back to localhost:3000 for local development without that env var.
 */
function internalUrl(path: string): string {
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}${path}`;
}

/**
 * Shared fetch wrapper with session cookie forwarding.
 * Returns null on auth failure (401/403) so callers can handle redirects
 * cleanly rather than throwing.
 */
async function serverFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  // Forward the session cookie so the API route can verify the session.
  // `auth()` already gives us the session object; we pass the Cookie header
  // extracted from incoming request headers so the route's `auth()` call
  // inside the handler also resolves correctly.
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(internalUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      ...(init?.headers ?? {}),
    },
    // No-store by default — pages opt into caching via `next.revalidate`
    // passed through the init argument when needed.
    cache: (init as RequestInit & { cache?: RequestCache })?.cache ?? "no-store",
  });

  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) {
    // Surface failures as null so page components can show a fallback rather
    // than crashing with an unhandled rejection at render time.
    return null;
  }

  return res.json() as Promise<T>;
}

// ─── Auth guard helper ────────────────────────────────────────────────────────

/**
 * Returns the authenticated user id, or null if the session is missing.
 * Call this at the top of any Server Component page to gate data fetching.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth();
  const user = session?.user as { id?: string } | undefined;
  return user?.id ?? null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardData {
  stats: DashboardStats;
  revenueTrend: RevenuePoint[];
  recentProjects: Project[];
}

/**
 * Fetch aggregated dashboard metrics for the current session user.
 * Returns null when unauthenticated or when the API call fails.
 */
export async function fetchDashboardData(): Promise<DashboardData | null> {
  type ApiShape = { data: DashboardData | null; error: string | null };
  const json = await serverFetch<ApiShape>("/api/dashboard");
  return json?.data ?? null;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

/**
 * Fetch the full user profile (plan, quota, avatarUrl, etc.) for the current session.
 * Returns null when unauthenticated or when the API call fails.
 */
export async function fetchUserProfile(): Promise<UserProfile | null> {
  return serverFetch<UserProfile>("/api/user");
}

// ─── Earnings Transactions ────────────────────────────────────────────────────

export interface EarningsPageData {
  transactions: EarningTransaction[];
  summary: EarningsSummary;
  trends: EarningsTrend;
  taxReady: boolean;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Fetch the first page of earnings transactions for server-side rendering.
 * Interactive pagination is handled client-side after hydration.
 */
export async function fetchEarningsTransactions(
  page = 1,
  pageSize = 20,
  startDate?: string,
  endDate?: string,
): Promise<EarningsPageData | null> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  type ApiShape = { data: EarningsPageData | null; error: string | null };
  const json = await serverFetch<ApiShape>(`/api/earnings/transactions?${params}`);
  return json?.data ?? null;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  totalViews: number;
  totalWatchTime: number;
  avgEngagement: number;
  byPlatform: { platform: string; views: number; engagement: number }[];
  top5: { clipId: string; title: string; views: number; platform: string }[];
  dateRange: { startDate: string | null; endDate: string | null };
}

/**
 * Fetch analytics data. No auth required by the API route, but we still go
 * through serverFetch for consistency and cookie forwarding.
 */
export async function fetchAnalyticsData(
  startDate?: string,
  platform?: string,
): Promise<AnalyticsData | null> {
  const params = new URLSearchParams();
  if (startDate) params.set("startDate", startDate);
  if (platform && platform !== "all") params.set("platform", platform);

  const query = params.toString();
  return serverFetch<AnalyticsData>(`/api/analytics${query ? `?${query}` : ""}`);
}

// ─── Billing Plans ────────────────────────────────────────────────────────────

/**
 * Fetch static billing plan definitions. No auth required.
 * Cache for 1 hour — plans change rarely.
 */
export async function fetchBillingPlans(): Promise<BillingPlan[]> {
  const json = await serverFetch<{ plans: BillingPlan[] }>("/api/billing/plans", {
    next: { revalidate: 3600 },
  } as RequestInit);
  return json?.plans ?? [];
}
