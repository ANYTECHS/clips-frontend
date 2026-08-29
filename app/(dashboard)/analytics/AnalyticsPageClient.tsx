"use client";

/**
 * AnalyticsPageClient
 *
 * Receives server-fetched initialData so the first render is instant.
 * Re-fetches client-side whenever the user changes the range or platform
 * filters. The CSV export uses the currently displayed data.
 */

import React, { useState, useEffect, useRef } from "react";
import StatCard from "@/components/dashboard/StatCard";
import { Download, Eye, Clock, BarChart3, AlertCircle } from "lucide-react";
import analytics from "@/app/lib/analytics";
import type { AnalyticsData } from "@/app/lib/serverData";
import ApiUsagePanel from "./ApiUsagePanel";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AnalyticsPageClientProps {
  /**
   * Data fetched server-side with the default filter values (30d / all).
   * When non-null the page renders immediately. When null the client fires
   * its own fetch as a fallback.
   */
  initialData: AnalyticsData | null;
  /** Initial range value read from searchParams server-side. Default "30d". */
  initialRange?: string;
  /** Initial platform value read from searchParams server-side. Default "all". */
  initialPlatform?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsPageClient({
  initialData,
  initialRange = "30d",
  initialPlatform = "all",
}: AnalyticsPageClientProps) {
  const [data, setData] = useState<AnalyticsData | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(initialRange);
  const [platform, setPlatform] = useState(initialPlatform);

  const initialized = useRef(false);

  // Track page view once on mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    analytics.trackPageView("/analytics");
  }, []);

  // Skip the initial fetch when we already have server data matching the
  // default filters. Re-fetch whenever filters change.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (
      isFirstRender.current &&
      initialData !== null &&
      range === initialRange &&
      platform === initialPlatform
    ) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (range !== "all") {
          const days = Number(range.replace("d", ""));
          const startDate = new Date(Date.now() - days * 86_400_000)
            .toISOString()
            .split("T")[0];
          params.set("startDate", startDate);
        }
        if (platform !== "all") params.set("platform", platform);

        const res = await fetch(`/api/analytics?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load analytics",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, platform]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── CSV export ────────────────────────────────────────────────────────────
  const exportCsv = () => {
    if (!data) return;
    const header = "clipId,title,views,platform\n";
    const rows = data.top5
      .map((t) => `${t.clipId},"${t.title}",${t.views},${t.platform}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        {/* Header + filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white">
              Clip Analytics
            </h1>
            <p className="text-muted text-[14px] mt-1">
              Views, watch time, engagement, and platform breakdown.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10"
              aria-label="Date range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10"
              aria-label="Platform filter"
            >
              <option value="all">All platforms</option>
              <option value="YouTube">YouTube</option>
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="Twitch">Twitch</option>
            </select>

            <button
              onClick={exportCsv}
              disabled={!data || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-black font-bold text-sm hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Data */}
        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                label="Total Views"
                value={String(data.totalViews)}
                icon={Eye}
                trend={`${data.totalViews.toLocaleString()} views`}
              />
              <StatCard
                label="Watch Time"
                value={`${data.totalWatchTime.toLocaleString()}m`}
                icon={Clock}
                trend="Total minutes watched"
              />
              <StatCard
                label="Engagement"
                value={`${data.avgEngagement.toFixed(2)}%`}
                icon={BarChart3}
                trend="Average rate"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement by platform */}
              <div className="bg-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">
                  Engagement by Platform
                </h3>
                <div className="space-y-3">
                  {data.byPlatform.map((p) => (
                    <div key={p.platform} className="flex items-center justify-between">
                      <span className="text-sm text-muted w-20 shrink-0">
                        {p.platform}
                      </span>
                      <div className="flex-1 mx-4">
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full"
                            style={{
                              width: `${Math.min(p.engagement * 10, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-white font-mono w-12 text-right">
                        {p.engagement}%
                      </span>
                    </div>
                  ))}
                  {data.byPlatform.length === 0 && (
                    <p className="text-muted text-sm">No platform data yet.</p>
                  )}
                </div>
              </div>

              {/* Top 5 clips */}
              <div className="bg-surface border border-white/5 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">Top 5 Clips</h3>
                <div className="space-y-3">
                  {data.top5.map((clip, idx) => (
                    <div
                      key={clip.clipId}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">
                          {clip.title}
                        </p>
                        <p className="text-xs text-muted">
                          {clip.platform} · {clip.views.toLocaleString()} views
                        </p>
                      </div>
                      <span className="text-xs text-muted w-6 text-right shrink-0">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                  {data.top5.length === 0 && (
                    <p className="text-muted text-sm">No clip data yet.</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <ApiUsagePanel />
      </div>
    </div>
  );
}
