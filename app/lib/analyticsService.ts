import { type Platform, type ClipMetric } from "./types"; // We will define this inline

export type AnalyticsPlatform = "YouTube" | "TikTok" | "Instagram" | "Twitch";
export type AnalyticsClipMetric = {
  clipId: string;
  title: string;
  views: number;
  watchTimeMinutes: number;
  engagementRate: number;
  platform: AnalyticsPlatform;
};

export type AnalyticsResponse = {
  totalViews: number;
  totalWatchTime: number;
  avgEngagement: number;
  byPlatform: { platform: string; views: number; engagement: number }[];
  top5: { clipId: string; title: string; views: number; platform: string }[];
  dateRange: { startDate: string | null; endDate: string | null };
};

export async function getAnalyticsData(
  startDate?: string,
  endDate?: string,
  platform?: AnalyticsPlatform
): Promise<AnalyticsResponse> {
  // Simulate slow fetch for streaming SSR
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const platforms: AnalyticsPlatform[] = ["YouTube", "TikTok", "Instagram", "Twitch"];
  const clips: AnalyticsClipMetric[] = [];
  const count = 40;

  for (let i = 0; i < count; i++) {
    const p = platform && platform !== "all" as any ? platform : platforms[Math.floor(Math.random() * platforms.length)];
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

  const totalViews = clips.reduce((s, m) => s + m.views, 0);
  const totalWatchTime = clips.reduce((s, m) => s + m.watchTimeMinutes, 0);
  const avgEngagement = clips.length ? clips.reduce((s, m) => s + m.engagementRate, 0) / clips.length : 0;

  const byPlatform: Record<string, { views: number; engagement: number; count: number }> = {};
  clips.forEach((m) => {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = { views: 0, engagement: 0, count: 0 };
    byPlatform[m.platform].views += m.views;
    byPlatform[m.platform].engagement += m.engagementRate;
    byPlatform[m.platform].count += 1;
  });

  const top5 = [...clips].sort((a, b) => b.views - a.views).slice(0, 5);

  return {
    totalViews,
    totalWatchTime,
    avgEngagement,
    byPlatform: Object.entries(byPlatform).map(([p, data]) => ({
      platform: p,
      views: data.views,
      engagement: parseFloat((data.engagement / data.count).toFixed(2)),
    })),
    top5,
    dateRange: { startDate: startDate || null, endDate: endDate || null },
  };
}
