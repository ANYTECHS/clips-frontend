"use client";

/**
 * EarningsPageClient
 *
 * Receives server-fetched initialData for page 1 and renders immediately
 * without a loading state. Interactive features (pagination, date filters,
 * export) are handled entirely client-side after hydration.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import StatCard from "@/components/dashboard/StatCard";

// eslint-disable-next-line @typescript-eslint/naming-convention
const EarningsTable = dynamic(() => import("@/components/dashboard/EarningsTable"), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((unused, i) => (
        <div key={i} className="h-12 bg-white/5 rounded-xl" />
      ))}
    </div>
  ),
});
import {
  Download,
  DollarSign,
  TrendingUp,
  Wallet,
  FileText,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import type {
  EarningTransaction,
  EarningsSummary,
  EarningsTrend,
} from "@/app/api/earnings/types";
import type { ApiResponse } from "@/app/api/types";
import type { EarningsResponse } from "@/app/api/earnings/types";
import { useFilterQueryState } from "@/hooks/useFilterQueryState";
import analytics from "@/app/lib/analytics";
import type { EarningsPageData } from "@/app/lib/serverData";

type ExportFormat = "csv" | "json" | "pdf";

// ─── CSV injection guard ──────────────────────────────────────────────────────

function sanitizeCsvCell(value: string): string {
  if (/^[=\t\r+\-@\\]/.test(value)) return "'" + value;
  return value;
}

// ─── Export menu ──────────────────────────────────────────────────────────────

function ExportMenu({
  onExport,
  exporting,
}: {
  onExport: (f: ExportFormat) => void;
  exporting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
      if (e instanceof KeyboardEvent && e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, []);

  const options: { format: ExportFormat; label: string; desc: string; Icon: React.ElementType }[] = [
    { format: "csv",  label: "CSV",  desc: "Spreadsheet / Excel",        Icon: FileSpreadsheet },
    { format: "json", label: "JSON", desc: "Developer / API integration", Icon: FileJson },
    { format: "pdf",  label: "PDF",  desc: "Tax filing / Accountant",     Icon: FileText },
  ];

  return (
    <div ref={ref} className="relative self-start lg:self-auto">
      <button
        onClick={() => !exporting && setOpen((o) => !o)}
        disabled={exporting}
        className="bg-brand hover:bg-brand-hover disabled:opacity-60 disabled:cursor-not-allowed text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Export options"
      >
        {exporting ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <Download className="w-4 h-4" aria-hidden="true" />
        )}
        {exporting ? "Exporting…" : "Export"}
        {!exporting && (
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Export formats"
          className="absolute right-0 top-full mt-2 w-56 bg-[#0C120F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {options.map(({ format, label, desc, Icon }) => (
            <button
              key={format}
              role="option"
              aria-selected={false}
              onClick={() => { onExport(format); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors group"
              aria-label={`Export as ${label}`}
            >
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[13px] font-bold text-white">{label}</p>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EarningsPageClientProps {
  /**
   * Data fetched server-side for page 1. When non-null the page renders
   * immediately without a loading spinner. When null (server fetch failed)
   * the client fires its own fetch as a fallback.
   */
  initialData: EarningsPageData | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EarningsPageClient({ initialData }: EarningsPageClientProps) {
  const [summary, setSummary] = useState<EarningsSummary>(
    initialData?.summary ?? { total: "0.00", completed: "0.00", pending: "0.00" }
  );
  const [trends, setTrends] = useState<EarningsTrend>(
    initialData?.trends ?? { totalTrend: { value: 0, label: "+0.0%" }, completedTrend: { value: 0, label: "+0.0%" } }
  );
  const [taxReady, setTaxReady] = useState(initialData?.taxReady ?? false);
  const [transactions, setTransactions] = useState<EarningTransaction[]>(
    initialData?.transactions ?? []
  );
  const [filteredTransactions, setFilteredTransactions] = useState<EarningTransaction[]>([]);
  const [pagination, setPagination] = useState(initialData?.pagination);
  // Start without a loading state when initialData is available.
  const [loading, setLoading] = useState(initialData === null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { filters, updateFilters } = useFilterQueryState({ page: 1, pageSize: 20 });
  const { page, pageSize } = filters;

  // Skip the initial fetch when we already have server data for page 1.
  const isFirstRender = useRef(true);

  useEffect(() => {
    // On the very first render with server data for page 1 skip the fetch;
    // subsequent page/size changes always re-fetch.
    if (isFirstRender.current && initialData !== null && page === 1) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        const res = await fetch(`/api/earnings/transactions?${params}`);

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const json: ApiResponse<EarningsResponse> = await res.json();
        if (json.error || !json.data) throw new Error(json.error ?? "Unexpected empty response");

        if (!cancelled) {
          const d = json.data;
          setSummary(d.summary);
          setTrends(d.trends);
          setTaxReady(d.taxReady);
          setTransactions(d.transactions);
          setPagination(d.pagination);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load earnings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PDF helper ───────────────────────────────────────────────────────────────
  const generatePdfHtml = useCallback((exportData: EarningTransaction[]) => {
    const rows = exportData
      .map((tx) => `<tr><td>${tx.date}</td><td>${tx.description}</td><td>$${tx.amount.toFixed(2)}</td><td>${tx.platform}</td><td>${tx.status}</td><td>${tx.taxId}</td></tr>`)
      .join("");
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>ClipCash Earnings Report</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}h1{font-size:20px;margin-bottom:4px}.meta{color:#555;margin-bottom:20px;font-size:11px}.summary{display:flex;gap:32px;margin-bottom:24px}.summary div{background:#f5f5f5;padding:12px 20px;border-radius:8px}.summary strong{display:block;font-size:18px}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-size:11px}td{padding:7px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#fafafa}@media print{body{padding:0}}</style>
</head><body>
<h1>ClipCash Earnings &amp; Tax Report</h1>
<p class="meta">Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Total: $${summary.total}</p>
<div class="summary"><div><span>Total Earned</span><strong>$${summary.total}</strong></div><div><span>Completed</span><strong>$${summary.completed}</strong></div><div><span>Pending</span><strong>$${summary.pending}</strong></div></div>
<table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Platform</th><th>Status</th><th>Tax ID</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  }, [summary]);

  // ─── Export ───────────────────────────────────────────────────────────────────
  const handleExport = async (format: ExportFormat) => {
    const exportData = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    if (exportData.length === 0) return;

    let pdfWindow: Window | null = null;
    if (format === "pdf") {
      pdfWindow = window.open("", "_blank");
      if (!pdfWindow) { alert("Pop-ups are blocked. Please allow pop-ups to export PDF."); return; }
    }

    setExporting(true);
    analytics.trackEarningsExport(format);

    try {
      if (format === "csv") {
        const csvContent = [
          ["Date", "Description", "Amount", "Platform", "Status", "Tax ID"],
          ...exportData.map((tx) => [tx.date, sanitizeCsvCell(tx.description), tx.amount.toFixed(2), sanitizeCsvCell(tx.platform), tx.status, sanitizeCsvCell(tx.taxId)]),
        ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        triggerDownload(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `clipcash-earnings-${monthStamp()}.csv`);
      } else if (format === "json") {
        triggerDownload(new Blob([JSON.stringify({ summary, transactions: exportData }, null, 2)], { type: "application/json;charset=utf-8;" }), `clipcash-earnings-${monthStamp()}.json`);
      } else if (format === "pdf" && pdfWindow) {
        pdfWindow.document.write(generatePdfHtml(exportData));
        pdfWindow.document.close();
        pdfWindow.focus();
        pdfWindow.print();
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const monthStamp = () => new Date().toISOString().slice(0, 7);

  // ─── Error state ──────────────────────────────────────────────────────────────
  if (error && transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 flex flex-col items-center gap-3 text-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-red-400 font-medium">Failed to load earnings</p>
        <p className="text-muted text-sm">{error}</p>
        <button onClick={() => updateFilters({ page: 1 })} className="mt-2 text-sm text-brand hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
            Earnings &amp; Tax Report
          </h1>
          <p className="text-muted text-[14px] mt-1">
            Complete transaction history for tax reporting.
            <span className="font-medium text-white ml-1">Total: ${summary.total}</span>
          </p>
        </div>
        <ExportMenu onExport={handleExport} exporting={exporting} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Earned"   value={`$${summary.total}`}     trend={trends.totalTrend}     icon={DollarSign} />
        <StatCard label="Completed"      value={`$${summary.completed}`} trend={trends.completedTrend} icon={TrendingUp} />
        <StatCard label="Pending Payout" value={`$${summary.pending}`}   trend="Processing"            icon={Wallet}     hideTrendIcon />
        <StatCard label="Tax Ready"      value={taxReady ? "✅ Yes" : "⏳ No"} trend={taxReady ? "Exportable" : "No completed transactions"} icon={FileText} hideTrendIcon />
      </div>

      {/* Transactions table */}
      <EarningsTable
        transactions={transactions}
        summary={summary}
        loading={loading}
        onFilteredTransactionsChange={setFilteredTransactions}
        pagination={pagination}
        onPageChange={(p) => updateFilters({ page: p })}
      />
    </div>
  );
}
