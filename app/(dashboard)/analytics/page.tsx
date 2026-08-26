"use client";

import React, { useEffect, useRef, useState } from "react";
import StatCard from "@/components/dashboard/StatCard";
import Skeleton from "@/components/ui/Skeleton";
import { Download, Eye, Clock, BarChart3 } from "lucide-react";
import analytics from "@/app/lib/analytics";

type AnalyticsResponse = {
  totalViews: number;
  totalWatchTime: number;
  avgEngagement: number;
  byPlatform: { platform: string; views: number; engagement: number }[];
  top5: { clipId: string; title: string; views: number; platform: string }[];
  dateRange: { startDate: string | null; endDate: string | null };
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("30d");
  const [platform, setPlatform] = useState("all");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    analytics.trackPageView("/analytics");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (range !== "all") params.set("startDate", new Date(Date.now() - Number(range.replace("d",""))*86400000).toISOString().split("T")[0]);
        if (platform !== "all") params.set("platform", platform);
        const res = await fetch(`/api/analytics?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [range, platform]);

  const exportCsv = () => {
    if (!data) return;
    const header = "clipId,title,views,watchTimeMinutes,engagementRate,platform\n";
    const rows = data.top5.map(t => `${t.clipId},"${t.title}",${t.views},,,${t.platform}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white">Clip Analytics</h1>
            <p className="text-muted text-[14px] mt-1">Views, watch time, engagement, and platform breakdown.</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={range} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRange(e.target.value)} className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <select value={platform} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlatform(e.target.value)} className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10">
              <option value="all">All platforms</option>
              <option value="YouTube">YouTube</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="Twitch">Twitch</option>
            </select>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-bold text-sm hover:bg-brand-hover transition-colors">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (<div key={i} className="h-32 rounded-2xl bg-white/6 animate-pulse" />))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-6">
            <p className="text-error text-sm">{error}</p>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Total Views" value={String(data.totalViews)} icon={Eye} trend={`${data.totalViews.toLocaleString()} views`} />
              <StatCard label="Watch Time" value={`${data.totalWatchTime.toLocaleString()}m`} icon={Clock} trend="Total minutes watched" />
              <StatCard label="Engagement" value={`${data.avgEngagement.toFixed(2)}%`} icon={BarChart3} trend="Average rate" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">Engagement by Platform</h3>
                <div className="space-y-3">
                  {data.byPlatform.map((p) => (
                    <div key={p.platform} className="flex items-center justify-between">
                      <span className="text-sm text-muted">{p.platform}</span>
                      <div className="flex-1 mx-4">
                        <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                          <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(p.engagement * 10, 100)}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-white font-mono w-12 text-right">{p.engagement}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">Top 5 Clips</h3>
                <div className="space-y-3">
                  {data.top5.map((clip, idx) => (
                    <div key={clip.clipId} className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{clip.title}</p>
                        <p className="text-xs text-muted">{clip.platform} · {clip.views.toLocaleString()} views</p>
                      </div>
                      <span className="text-xs text-muted w-6 text-right">#{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}