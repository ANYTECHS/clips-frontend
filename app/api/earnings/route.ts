/**
 * GET /api/earnings
 *
 * Aggregated earnings summary consumed by the dashboard store
 * (app/lib/apiClient → fetchEarningsFromAPI).
 *
 * Returns high-level totals and trend for the KPI cards on the main
 * dashboard — not the full transaction list (that lives at
 * GET /api/earnings/transactions).
 *
 * Issue #889 – API versioning headers added.
 * Issue #890 – Zod query-param validation via EarningsQuerySchema.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { earningsStore } from "./earningsStore";
import { EarningsQuerySchema, parseQuery } from "@/app/api/schemas";
import { withVersioning } from "@/app/api/versioning";
import type { ApiResponse } from "../types";
import type { EarningTransaction } from "./types";

function sumAmount(txs: EarningTransaction[]): number {
  return txs.reduce((acc, tx) => acc + tx.amount, 0);
}

function calcTrendLabel(current: number, previous: number): { value: number; label: string } {
  if (previous === 0) {
    const value = current > 0 ? 100 : 0;
    return { value, label: value === 0 ? "+0.0%" : "+100.0%" };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return {
    value: rounded,
    label: (rounded >= 0 ? "+" : "") + rounded.toFixed(1) + "%",
  };
}

export async function GET(request: NextRequest) {
  const rateLimited = applyRateLimit(request, { limit: 60, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Validate query params — issue #890
  const queryValidation = parseQuery(EarningsQuerySchema, request.nextUrl.searchParams);
  if (!queryValidation.ok) {
    return NextResponse.json(
      { data: null, error: "Invalid query parameters", issues: queryValidation.result.issues },
      { status: 400 }
    );
  }

  return withVersioning(request, () => {
    const allTransactions = earningsStore.getTransactions(userId);

    // 30-day current vs prior window for trend
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
    const trend = calcTrendLabel(currentTotal, priorTotal);

    const completedAll = allTransactions.filter((tx) => tx.status === "completed");
    const pendingAll = allTransactions.filter((tx) => tx.status === "pending");

    const totalEarnings = sumAmount(allTransactions).toFixed(2);
    const completedEarnings = sumAmount(completedAll).toFixed(2);
    const pendingEarnings = sumAmount(pendingAll).toFixed(2);

    // Crypto holdings summary
    const cryptoTxs = allTransactions.filter((tx) => tx.cryptoAmount !== undefined);
    const cryptoTotal = cryptoTxs.reduce((acc, tx) => acc + (tx.cryptoAmount ?? 0), 0);

    const responseData = {
      totalEarnings: `$${totalEarnings}`,
      totalTrend: trend.value,
      trendLabel: `${trend.label} from last month`,
      totalFiat: { value: `$${totalEarnings}`, change: trend.value },
      cryptoRevenue: { value: `${cryptoTotal.toFixed(4)} ETH`, change: 0 },
      pendingPayouts: { value: `$${pendingEarnings}`, change: 0 },
      breakdown: completedAll.slice(0, 5).map((tx) => ({
        id: tx.id,
        label: tx.description,
        amount: tx.amount,
        date: tx.date,
        platform: tx.platform.toLowerCase(),
      })),
    };

    const body: ApiResponse<typeof responseData> = { data: responseData, error: null };
    return NextResponse.json(body);
  });
}
