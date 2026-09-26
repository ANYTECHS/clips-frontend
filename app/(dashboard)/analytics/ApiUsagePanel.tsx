"use client";

/**
 * ApiUsagePanel
 *
 * Developer/ops-facing view of API usage: per-endpoint request volume and
 * error rate, latency percentiles, and the most active users. Backed by the
 * in-memory tracker in app/lib/apiAnalytics.ts (see /api/analytics/api-usage).
 */

import { useEffect, useState } from "react";

interface EndpointAnalytics {
  route: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
}

interface UserAnalytics {
  userId: string;
  requestCount: number;
  lastSeenAt: string;
  topEndpoints: string[];
}

interface PerformanceAnalytics {
  totalRequests: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  slowestEndpoints: { route: string; avgDurationMs: number }[];
}

interface ApiUsageSummary {
  endpoints: EndpointAnalytics[];
  users: UserAnalytics[];
  performance: PerformanceAnalytics;
  totalRequests: number;
  generatedAt: string;
}

export default function ApiUsagePanel() {
  const [summary, setSummary] = useState<ApiUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analytics/api-usage");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiUsageSummary;
        if (!cancelled) setSummary(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load API usage");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <h3 className="text-white font-bold mb-2">API Usage</h3>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <h3 className="text-white font-bold mb-4">API Usage</h3>
        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-white font-bold mb-1">API Usage & Performance</h3>
        <p className="text-muted text-xs">
          {summary.totalRequests.toLocaleString()} requests tracked · p50{" "}
          {summary.performance.p50DurationMs}ms · p95 {summary.performance.p95DurationMs}ms
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs uppercase">
              <th className="pb-2 pr-4">Endpoint</th>
              <th className="pb-2 pr-4">Requests</th>
              <th className="pb-2 pr-4">Error rate</th>
              <th className="pb-2 pr-4">Avg (ms)</th>
              <th className="pb-2">p95 (ms)</th>
            </tr>
          </thead>
          <tbody>
            {summary.endpoints.map((endpoint) => (
              <tr key={endpoint.route} className="border-t border-white/5">
                <td className="py-2 pr-4 text-white font-mono text-xs">{endpoint.route}</td>
                <td className="py-2 pr-4 text-white">{endpoint.requestCount}</td>
                <td className="py-2 pr-4 text-white">
                  {(endpoint.errorRate * 100).toFixed(1)}%
                </td>
                <td className="py-2 pr-4 text-white">{endpoint.avgDurationMs}</td>
                <td className="py-2 text-white">{endpoint.p95DurationMs}</td>
              </tr>
            ))}
            {summary.endpoints.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-muted text-sm">
                  No API requests tracked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="text-white font-semibold text-sm mb-2">Most active users</h4>
        <div className="space-y-2">
          {summary.users.map((user) => (
            <div key={user.userId} className="flex items-center justify-between text-sm">
              <span className="text-white font-mono text-xs truncate max-w-[200px]">
                {user.userId}
              </span>
              <span className="text-muted text-xs">
                {user.requestCount} req · {user.topEndpoints.join(", ")}
              </span>
            </div>
          ))}
          {summary.users.length === 0 && (
            <p className="text-muted text-sm">No user activity tracked yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
