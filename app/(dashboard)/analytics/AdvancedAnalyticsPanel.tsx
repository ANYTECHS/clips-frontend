"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface Cohort { cohort: string; users: number; retention: number[] }
interface FunnelStage { name: string; users: number; conversion: number }
interface Attribution { source: string; revenue: number; conversions: number }
interface AdvancedData { cohorts: Cohort[]; funnel: FunnelStage[]; attribution: Attribution[] }

export default function AdvancedAnalyticsPanel() {
  const [data, setData] = useState<AdvancedData | null>(null);

  useEffect(() => {
    fetch("/api/analytics/advanced").then((response) => response.ok ? response.json() : null).then(setData).catch(() => setData(null));
  }, []);

  const exportReport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "advanced-analytics-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return null;

  return (
    <section className="space-y-6" aria-labelledby="advanced-analytics-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="advanced-analytics-title" className="text-xl font-bold text-white">Advanced analytics</h2>
          <p className="text-sm text-muted mt-1">Cohorts, funnel conversion, retention, and revenue attribution.</p>
        </div>
        <button type="button" onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5">
          <Download className="h-4 w-4" aria-hidden="true" /> Export report
        </button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface border border-white/5 rounded-2xl p-6 overflow-x-auto">
          <h3 className="font-bold text-white mb-4">Cohort retention</h3>
          <table className="w-full text-sm"><thead><tr className="text-left text-muted"><th className="pb-3">Cohort</th><th className="pb-3">Users</th><th className="pb-3">Retention</th></tr></thead><tbody>
            {data.cohorts.map((cohort) => <tr key={cohort.cohort} className="border-t border-white/5"><td className="py-3 text-white">{cohort.cohort}</td><td className="py-3 text-muted">{cohort.users}</td><td className="py-3 text-brand">{cohort.retention.map((value) => `${value}%`).join(" / ")}</td></tr>)}
          </tbody></table>
        </div>
        <div className="bg-surface border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-4">Conversion funnel</h3>
          <div className="space-y-4">{data.funnel.map((stage) => <div key={stage.name}><div className="flex justify-between text-sm mb-1"><span className="text-white">{stage.name}</span><span className="text-muted">{stage.users.toLocaleString()} · {stage.conversion}%</span></div><div className="h-2 rounded-full bg-white/5"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(stage.conversion, 100)}%` }} /></div></div>)}</div>
        </div>
      </div>
      <div className="bg-surface border border-white/5 rounded-2xl p-6">
        <h3 className="font-bold text-white mb-4">Revenue attribution</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{data.attribution.map((item) => <div key={item.source} className="border border-white/5 rounded-xl p-4"><p className="text-sm text-muted">{item.source}</p><p className="text-2xl font-bold text-white mt-1">${item.revenue.toLocaleString()}</p><p className="text-xs text-brand mt-1">{item.conversions} conversions</p></div>)}</div>
      </div>
    </section>
  );
}
