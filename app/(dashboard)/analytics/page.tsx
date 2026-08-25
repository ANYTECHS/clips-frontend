import React, { Suspense } from "react";
import { getAnalyticsData, type AnalyticsPlatform } from "@/app/lib/analyticsService";
import AnalyticsClient from "./AnalyticsClient";
import AnalyticsLoading from "./loading";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams;
  const range = (searchParams.range as string) || "30d";
  const platform = (searchParams.platform as AnalyticsPlatform) || "all";
  
  let startDate: string | undefined;
  if (range !== "all") {
    startDate = new Date(Date.now() - Number(range.replace("d",""))*86400000).toISOString().split("T")[0];
  }

  const data = await getAnalyticsData(startDate, undefined, platform);

  return (
    <Suspense fallback={<AnalyticsLoading />}>
      <AnalyticsClient initialData={data} initialRange={range} initialPlatform={platform} />
    </Suspense>
  );
}
