"use client";

/**
 * RateLimitMonitoringPanel
 *
 * Ops-facing view of rate limit customization in effect: how often each
 * route/plan tier gets throttled. Backed by app/lib/rateLimitMonitoring.ts
 * (see /api/analytics/rate-limits).
 */

import { useEffect, useState } from "react";

interface RateLimitRouteSummary {
  route: string;
  requestCount: number;
  limitedCount: number;
  limitedRate: number;
}

interface RateLimitPlanSummary {
  plan: string;
  requestCount: number;
  limitedCount: number;
  limitedRate: number;
}

interface RateLimitMonitoringSummary {
  totalRequests: number;
  totalLimited: number;
  limitedRate: number;
  byRoute: RateLimitRouteSummary[];
  byPlan: RateLimitPlanSummary[];
}

export default function RateLimitMonitoringPanel() {
  const [summary, setSummary] = useState<RateLimitMonitoringSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/analytics/rate-limits");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RateLimitMonitoringSummary;
        if (!cancelled) setSummary(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load rate limit monitoring");
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
        <h3 className="text-white font-bold mb-2">Rate Limit Monitoring</h3>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <h3 className="text-white font-bold mb-4">Rate Limit Monitoring</h3>
        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
      <div>
        <h3 className="text-white font-bold mb-1">Rate Limit Monitoring</h3>
        <p className="text-muted text-xs">
          {summary.totalRequests.toLocaleString()} requests checked ·{" "}
          {summary.totalLimited.toLocaleString()} throttled (
          {(summary.limitedRate * 100).toFixed(1)}%)
        </p>
      </div>

      <div>
        <h4 className="text-white font-semibold text-sm mb-2">By plan tier</h4>
        <div className="space-y-2">
          {summary.byPlan.map((plan) => (
            <div key={plan.plan} className="flex items-center justify-between text-sm">
              <span className="text-white capitalize">{plan.plan}</span>
              <span className="text-muted text-xs">
                {plan.requestCount} req · {plan.limitedCount} throttled (
                {(plan.limitedRate * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
          {summary.byPlan.length === 0 && (
            <p className="text-muted text-sm">No rate-limited requests tracked yet.</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted text-xs uppercase">
              <th className="pb-2 pr-4">Endpoint</th>
              <th className="pb-2 pr-4">Requests</th>
              <th className="pb-2">Throttled</th>
            </tr>
          </thead>
          <tbody>
            {summary.byRoute.map((route) => (
              <tr key={route.route} className="border-t border-white/5">
                <td className="py-2 pr-4 text-white font-mono text-xs">{route.route}</td>
                <td className="py-2 pr-4 text-white">{route.requestCount}</td>
                <td className="py-2 text-white">
                  {route.limitedCount} ({(route.limitedRate * 100).toFixed(1)}%)
                </td>
              </tr>
            ))}
            {summary.byRoute.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-muted text-sm">
                  No requests tracked yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
