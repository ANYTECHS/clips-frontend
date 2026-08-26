/**
 * GET /api/earnings/transactions
 *
 * Query params:
 *   page       – 1-based page number (default: 1)
 *   pageSize   – records per page, 1–100 (default: 20)
 *   startDate  – ISO date string YYYY-MM-DD, inclusive (optional)
 *   endDate    – ISO date string YYYY-MM-DD, inclusive (optional)
 *
 * Returns ApiResponse<EarningsResponse> with:
 *   - Paginated transactions for the authenticated user
 *   - Summary totals (total / completed / pending) scoped to the filtered set
 *   - Trend comparison: current 30-day period vs the prior 30-day period
 *   - taxReady: true when at least one completed transaction exists in the full dataset
 *   - Pagination metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/api/jobs/shared/authGuard";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { earningsStore } from "../earningsStore";
import type { ApiResponse } from "../../types";
import type { EarningsResponse, EarningTransaction } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function sumAmount(txs: EarningTransaction[]): number {
  return txs.reduce((acc, tx) => acc + tx.amount, 0);
}

/**
 * Computes a percentage trend label comparing `current` against `previous`.
 * Returns "+0.0%" when there is no prior-period data to compare against.
 */
function calcTrend(current: number, previous: number): { value: number; label: string } {
  if (previous === 0) {
    const value = current > 0 ? 100 : 0;
    return { value, label: value === 0 ? "+0.0%" : "+100.0%" };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const label = (rounded >= 0 ? "+" : "") + rounded.toFixed(1) + "%";
  return { value: rounded, label };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Rate limit
  const rateLimited = applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  // 2. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // 3. Parse & validate query params
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20)
  );

  const rawStartDate = searchParams.get("startDate");
  const rawEndDate = searchParams.get("endDate");

  if (rawStartDate && !isValidDate(rawStartDate)) {
    const body: ApiResponse<null> = {
      data: null,
      error: "Invalid startDate. Expected YYYY-MM-DD.",
      code: "INVALID_PARAM",
    };
    return NextResponse.json(body, { status: 400 });
  }

  if (rawEndDate && !isValidDate(rawEndDate)) {
    const body: ApiResponse<null> = {
      data: null,
      error: "Invalid endDate. Expected YYYY-MM-DD.",
      code: "INVALID_PARAM",
    };
    return NextResponse.json(body, { status: 400 });
  }

  // 4. Load the user's full transaction list
  const allTransactions = earningsStore.getTransactions(userId);

  // 5. Apply date filters
  const filtered = allTransactions.filter((tx) => {
    if (rawStartDate && tx.date < rawStartDate) return false;
    if (rawEndDate && tx.date > rawEndDate) return false;
    return true;
  });

  // 6. Compute summary over the filtered set
  const completedTxs = filtered.filter((tx) => tx.status === "completed");
  const pendingTxs = filtered.filter((tx) => tx.status === "pending");

  const summary = {
    total: sumAmount(filtered).toFixed(2),
    completed: sumAmount(completedTxs).toFixed(2),
    pending: sumAmount(pendingTxs).toFixed(2),
  };

  // 7. Compute 30-day trend (current window vs prior window) over the full dataset.
  //    We intentionally use the full dataset (not the date-filtered subset) so that
  //    trend cards always show meaningful comparisons even with a narrow filter window.
  const now = new Date();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const currentWindowStart = new Date(now.getTime() - thirtyDaysMs)
    .toISOString()
    .split("T")[0];
  const priorWindowStart = new Date(now.getTime() - 2 * thirtyDaysMs)
    .toISOString()
    .split("T")[0];
  const today = now.toISOString().split("T")[0];

  const currentPeriod = allTransactions.filter(
    (tx) => tx.date >= currentWindowStart && tx.date <= today
  );
  const priorPeriod = allTransactions.filter(
    (tx) => tx.date >= priorWindowStart && tx.date < currentWindowStart
  );

  const currentTotal = sumAmount(currentPeriod);
  const priorTotal = sumAmount(priorPeriod);

  const currentCompleted = sumAmount(
    currentPeriod.filter((tx) => tx.status === "completed")
  );
  const priorCompleted = sumAmount(
    priorPeriod.filter((tx) => tx.status === "completed")
  );

  const trends = {
    totalTrend: calcTrend(currentTotal, priorTotal),
    completedTrend: calcTrend(currentCompleted, priorCompleted),
  };

  // 8. Tax-ready: true when at least one completed transaction exists anywhere
  //    in the user's full dataset (not gated by the current filter window).
  const taxReady = allTransactions.some((tx) => tx.status === "completed");

  // 9. Paginate the filtered results
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  const transactions = filtered.slice(start, start + pageSize);

  const responseData: EarningsResponse = {
    transactions,
    summary,
    trends,
    taxReady,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };

  const body: ApiResponse<EarningsResponse> = { data: responseData, error: null };
  return NextResponse.json(body);
}
