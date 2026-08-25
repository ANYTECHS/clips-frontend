import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Platform = "YouTube" | "TikTok" | "Instagram" | "Twitch";
type ClipMetric = {
  clipId: string;
  title: string;
  views: number;
  watchTimeMinutes: number;
  engagementRate: number;
  platform: Platform;
};

function generateMockMetrics(startDate?: string, endDate?: string, platform?: Platform): ClipMetric[] {
  const platforms: Platform[] = ["YouTube", "TikTok", "Instagram", "Twitch"];
  const clips: ClipMetric[] = [];
  const count = 40;

  for (let i = 0; i < count; i++) {
    const p = platform ?? platforms[Math.floor(Math.random() * platforms.length)];
    const views = Math.floor(Math.random() * 50000) + 1000;
    clips.push({
      clipId: `CLIP-${String(i + 1).padStart(3, "0")}`,
      title: `Clip ${i + 1}`,
      views,
      watchTimeMinutes: Math.floor(views * (Math.random() * 0.4 + 0.1)),
      engagementRate: parseFloat((Math.random() * 8 + 1).toFixed(2)),
      platform: p,
    });
  }

  return clips;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const platform = searchParams.get("platform") as Platform | null;

  const metrics = generateMockMetrics(startDate || undefined, endDate || undefined, platform || undefined);

  const totalViews = metrics.reduce((s, m) => s + m.views, 0);
  const totalWatchTime = metrics.reduce((s, m) => s + m.watchTimeMinutes, 0);
  const avgEngagement = metrics.length ? metrics.reduce((s, m) => s + m.engagementRate, 0) / metrics.length : 0;

  const byPlatform: Record<string, { views: number; engagement: number; count: number }> = {};
  metrics.forEach((m) => {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = { views: 0, engagement: 0, count: 0 };
    byPlatform[m.platform].views += m.views;
    byPlatform[m.platform].engagement += m.engagementRate;
    byPlatform[m.platform].count += 1;
  });

  const top5 = [...metrics].sort((a, b) => b.views - a.views).slice(0, 5);

  return NextResponse.json({
    totalViews,
    totalWatchTime,
    avgEngagement,
    byPlatform: Object.entries(byPlatform).map(([platform, data]) => ({
      platform,
      views: data.views,
      engagement: parseFloat((data.engagement / data.count).toFixed(2)),
    })),
    top5,
    dateRange: { startDate: startDate || null, endDate: endDate || null },
  });
}