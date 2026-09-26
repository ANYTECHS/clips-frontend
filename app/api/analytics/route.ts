import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsData, type AnalyticsPlatform } from "@/app/lib/analyticsService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const platform = searchParams.get("platform") as AnalyticsPlatform | null;

  const data = await getAnalyticsData(startDate, endDate, platform || undefined);
  return NextResponse.json(data);
}