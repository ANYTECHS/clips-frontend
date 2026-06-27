"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import EarningsTable from "@/components/dashboard/EarningsTable";
import StatCard from "@/components/dashboard/StatCard";
import {
  Download,
  DollarSign,
  TrendingUp,
  Wallet,
  FileText,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { MockApi, type Summary, type Transaction } from "@/app/lib/mockApi";
import { useAuth } from "@/components/AuthProvider";
import analytics from "@/app/lib/analytics";
import { useFilterQueryState } from "@/hooks/useFilterQueryState";

type ExportFormat = "csv" | "json" | "pdf";

/**
 * Prepend a single quote to any cell starting with characters that trigger
 * formula execution in spreadsheet applications (=, +, -, @) or control
 * characters (\t, \r). Also strips leading backslashes as an extra guard.
 */
function sanitizeCsvCell(value: string): string {
  if (/^[=\t\r+\-@\\]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function ExportMenu({ onExport, exporting }: { onExport: (f: ExportFormat) => void; exporting: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    { format: "csv",  label: "CSV",  desc: "Spreadsheet / Excel",       Icon: FileSpreadsheet },
    { format: "json", label: "JSON", desc: "Developer / API integration", Icon: FileJson },
    { format: "pdf",  label: "PDF",  desc: "Tax filing / Accountant",    Icon: FileText },
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
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <Download className="w-4 h-4" aria-hidden="true" />
        )}
        {exporting ? "Exporting…" : "Export"}
        {!exporting && <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
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

export default function EarningsPage() {
  const [summary, setSummary] = useState<Summary>({
    total: "0.00",
    completed: "0.00",
    pending: "0.00",
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | undefined>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();

  const { filters, updateFilters } = useFilterQueryState({ page: 1, pageSize: 20 });
  const { page, pageSize } = filters;

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const data = await MockApi.getEarningsReport(user.id, { page, pageSize });
        setSummary(data.summary);
        setTransactions(data.transactions);
        setPagination(data.pagination);
      } catch (error) {
        console.error("Failed to load earnings summary:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id, page, pageSize]);

  const generatePdfHtml = useCallback((exportData: Transaction[]) => {
    const rows = exportData
      .map(
        (tx) =>
          `<tr>
            <td>${tx.date}</td>
            <td>${tx.description}</td>
            <td>$${tx.amount.toFixed(2)}</td>
            <td>${tx.platform}</td>
            <td>${tx.status}</td>
            <td>${tx.taxId}</td>
          </tr>`,
      )
      .join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ClipCash Earnings Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #555; margin-bottom: 20px; font-size: 11px; }
    .summary { display: flex; gap: 32px; margin-bottom: 24px; }
    .summary div { background: #f5f5f5; padding: 12px 20px; border-radius: 8px; }
    .summary strong { display: block; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #111; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>ClipCash Earnings & Tax Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Total: $${summary.total}</p>
  <div class="summary">
    <div><span>Total Earned</span><strong>$${summary.total}</strong></div>
    <div><span>Completed</span><strong>$${summary.completed}</strong></div>
    <div><span>Pending</span><strong>$${summary.pending}</strong></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Platform</th><th>Status</th><th>Tax ID</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  }, [summary]);

  const exportCSV = async (format: "csv" | "json" | "pdf") => {
    const exportData = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    if (!user?.id || exportData.length === 0) return;

    // For PDF, open the popup synchronously before any async operations
    let pdfWindow: Window | null = null;
    if (format === "pdf") {
      pdfWindow = window.open("", "_blank");
      if (!pdfWindow) {
        alert("Pop-ups are blocked. Please allow pop-ups for this site to export PDF.");
        return;
      }
    }

    setExporting(true);
    analytics.trackEarningsExport(format);

    try {
      if (format === "csv") {
        const csvContent = [
          ["Date", "Description", "Amount", "Platform", "Status", "Tax ID"],
          ...exportData.map((tx) => [
            tx.date,
            sanitizeCsvCell(tx.description),
            tx.amount.toFixed(2),
            sanitizeCsvCell(tx.platform),
            tx.status,
            sanitizeCsvCell(tx.taxId),
          ]),
        ]
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
          )
          .join("\r\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        triggerDownload(blob, `clipcash-earnings-${monthStamp()}.csv`);

      } else if (format === "json") {
        const json = JSON.stringify({ summary, transactions: exportData }, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        triggerDownload(blob, `clipcash-earnings-${monthStamp()}.json`);

      } else if (format === "pdf" && pdfWindow) {
        const html = generatePdfHtml(exportData);

        // Write to the already-opened window (synchronous, so no popup block)
        pdfWindow.document.write(html);
        pdfWindow.document.close();
        pdfWindow.focus();
        pdfWindow.print();
      }
    } catch (error) {
      console.error("Export failed:", error);
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="h-9 w-64 rounded-xl bg-white/6 animate-pulse" />
              <div className="h-4 w-80 rounded-lg bg-white/6 animate-pulse" />
            </div>
            <div className="h-11 w-28 rounded-xl bg-white/6 animate-pulse" />
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/6 animate-pulse" />
            ))}
          </div>
          {/* Table skeleton */}
          <div className="rounded-2xl bg-white/6 animate-pulse h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
              Earnings & Tax Report
            </h1>
            <p className="text-muted text-[14px] mt-1">
              Complete transaction history for tax reporting.
              <span className="font-medium text-white ml-1">
                Total: ${summary.total}
              </span>
            </p>
          </div>
          <ExportMenu onExport={exportCSV} exporting={exporting} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Earned"
            value={`$${summary.total}`}
            trend="+12.5%"
            icon={DollarSign}
          />
          <StatCard
            label="Completed"
            value={`$${summary.completed}`}
            trend="+8.2%"
            icon={TrendingUp}
          />
          <StatCard
            label="Pending Payout"
            value={`$${summary.pending}`}
            trend="Processing"
            icon={Wallet}
            hideTrendIcon={true}
          />
          <StatCard
            label="Tax Ready"
            value="✅ Yes"
            trend="Exportable"
            icon={FileText}
            hideTrendIcon={true}
          />
        </div>

        <EarningsTable
          transactions={transactions}
          summary={summary}
          loading={loading}
          onFilteredTransactionsChange={setFilteredTransactions}
          pagination={pagination}
          onPageChange={(p) => updateFilters({ page: p })}
        />
      </div>
    </div>
  );
}
