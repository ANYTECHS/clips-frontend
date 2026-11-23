"use client";

import React from "react";
import Skeleton, { CardSkeleton, RowSkeleton } from "@/components/shared/Skeleton";

/**
 * Issue #1242 — skeleton presets for dashboard routes.
 *
 * Each preset mirrors the box model (padding, radius, gap, min-height) of the
 * component it stands in for, so swapping the skeleton for real content does
 * not move anything on the page (no CLS). Use these in `loading.tsx` files
 * and in a page's own `isLoading` branch so both states look identical.
 */

/** Page title + subtitle, matching the `<h1>` / `<p>` pair on dashboard pages. */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton w="w-40" h="h-8" />
      <Skeleton w="w-56" h="h-5" />
    </div>
  );
}

/** Mirrors `components/dashboard/StatCard`. */
export function StatCardSkeleton() {
  return (
    <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-5 sm:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton w="w-36" h="h-4" />
        <Skeleton w="w-10" h="h-10" rounded="rounded-xl" />
      </div>
      <div className="flex items-end gap-3">
        <Skeleton w="w-20" h="h-8" />
        <Skeleton w="w-14" h="h-4" />
      </div>
    </div>
  );
}

/** A row of stat cards; stacks vertically on mobile like the real grid. */
export function StatCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors the summary cards on the analytics / earnings pages. */
export function SummaryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6">
      <Skeleton w="w-28" h="h-4" className="mb-3" />
      <Skeleton w="w-32" h="h-9" />
    </div>
  );
}

export function SummaryCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <SummaryCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Mirrors `components/analytics/EarningsChart` (title + h-64 plot). */
export function ChartSkeleton() {
  return (
    <div className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4">
      <Skeleton w="w-36" h="h-4" className="mb-4" />
      <Skeleton h="h-64" rounded="rounded-lg" />
    </div>
  );
}

/** Grid of project cards (dashboard "Recent Projects"). */
export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Mirrors `components/dashboard/EarningsTable`: a real table at ≥md and
 * stacked cards below 768px.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  const rowList = Array.from({ length: rows }, (_, i) => i);
  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-4 sm:p-6">
      <div className="hidden md:block">
        <div className="flex gap-4 border-b border-[#0e4d2a] pb-3">
          {cols.map((c) => (
            <Skeleton key={c} w="flex-1" h="h-3" />
          ))}
        </div>
        {rowList.map((r) => (
          <div key={r} className="flex gap-4 py-4 border-b border-[#0e4d2a]/40 last:border-0">
            {cols.map((c) => (
              <Skeleton key={c} w="flex-1" h="h-4" />
            ))}
          </div>
        ))}
      </div>
      <ul className="md:hidden space-y-3">
        {rowList.map((r) => (
          <li key={r} className="rounded-xl border border-[#0e4d2a] bg-[#042413] p-4 space-y-3">
            {cols.map((c) => (
              <div key={c} className="flex items-center justify-between gap-3">
                <Skeleton w="w-16" h="h-3" />
                <Skeleton w="w-24" h="h-4" />
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Mirrors the wallet balance card. */
export function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton w="w-10" h="h-10" rounded="rounded-xl" />
        <div className="space-y-2">
          <Skeleton w="w-24" h="h-4" />
          <Skeleton w="w-32" h="h-3" />
        </div>
      </div>
      <Skeleton w="w-44" h="h-10" />
      <div className="flex gap-3">
        <Skeleton w="w-24" h="h-6" rounded="rounded-full" />
        <Skeleton w="w-24" h="h-6" rounded="rounded-full" />
      </div>
    </div>
  );
}

/** Mirrors the wallet transaction list. */
export function TransactionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-[#0e4d2a] bg-[#06351C] overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-[#0e4d2a]">
        <Skeleton w="w-40" h="h-5" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Route-level presets (shared by loading.tsx and each page's loading) */
/* ------------------------------------------------------------------ */

const pageShell = "mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10";

/** `/dashboard`: stat cards + recent projects. */
export function DashboardPageSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 space-y-10 max-w-[1400px] mx-auto w-full" role="status" aria-label="Loading dashboard">
      <StatCardsSkeleton count={2} />
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
          <Skeleton w="w-44" h="h-7" />
          <Skeleton w="w-28" h="h-4" />
        </div>
        <ProjectGridSkeleton count={6} />
      </div>
    </div>
  );
}

/** `/analytics`: summary cards + chart area. */
export function AnalyticsPageSkeleton() {
  return (
    <div className={pageShell} role="status" aria-label="Loading analytics">
      <PageHeaderSkeleton />
      <SummaryCardsSkeleton count={2} />
      <ChartSkeleton />
    </div>
  );
}

/** `/earnings`: summary cards + earnings table. */
export function EarningsPageSkeleton() {
  return (
    <div className={pageShell} role="status" aria-label="Loading earnings">
      <PageHeaderSkeleton />
      <SummaryCardsSkeleton count={2} />
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}

/** `/wallet`: balance card + transaction list. */
export function WalletPageSkeleton() {
  return (
    <div className={pageShell} role="status" aria-label="Loading wallet">
      <PageHeaderSkeleton />
      <BalanceCardSkeleton />
      <TransactionListSkeleton rows={5} />
    </div>
  );
}
