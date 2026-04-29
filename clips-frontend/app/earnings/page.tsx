"use client";

import React, { useState, useEffect, useRef } from "react";
import EarningsLayout from "@/components/dashboard/EarningsLayout";
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

type ExportFormat = "csv" | "json" | "pdf";

function ExportMenu({ onExport }: { onExport: (f: ExportFormat) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options: { format: ExportFormat; label: string; desc: string; Icon: React.ElementType }[] = [
    { format: "csv",  label: "CSV",  desc: "Spreadsheet / Excel",       Icon: FileSpreadsheet },
    { format: "json", label: "JSON", desc: "Developer / API integration", Icon: FileJson },
    { format: "pdf",  label: "PDF",  desc: "Tax filing / Accountant",    Icon: FileText },
  ];

  return (
    <div ref={ref} className="relative self-start lg:self-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all"
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0C120F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {options.map(({ format, label, desc, Icon }) => (
            <button
              key={format}
              onClick={() => { onExport(format); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors group"
            >
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-brand transition-colors shrink-0" />
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
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const data = await MockApi.getEarningsReport(user.id);
        setSummary(data.summary);
        setTransactions(data.transactions);
      } catch (error) {
        console.error("Failed to load earnings summary:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const exportCSV = (format: "csv" | "json" | "pdf") => {
    if (!user?.id || transactions.length === 0) return;

    try {
      if (format === "csv") {
        const csvContent = [
          ["Date", "Description", "Amount", "Platform", "Status", "Tax ID"],
          ...transactions.map((tx) => [
            tx.date,
            tx.description,
            tx.amount.toFixed(2),
            tx.platform,
            tx.status,
            tx.taxId,
          ]),
        ]
          .map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
          )
          .join("\r\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        triggerDownload(blob, `clipcash-earnings-${today()}.csv`);

      } else if (format === "json") {
        const json = JSON.stringify({ summary, transactions }, null, 2);
        const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
        triggerDownload(blob, `clipcash-earnings-${today()}.json`);

      } else if (format === "pdf") {
        // Build a minimal printable HTML document and open the browser print dialog
        const rows = transactions
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

        const html = `<!DOCTYPE html>
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
  <h1>ClipCash Earnings &amp; Tax Report</h1>
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

        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          win.focus();
          win.print();
        }
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
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

  const today = () => new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <EarningsLayout>
        <div className="space-y-8 p-12 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-brand border-t-transparent rounded-full mb-4"></div>
          <p className="text-white">Loading your financial data...</p>
        </div>
      </EarningsLayout>
    );
  }

  return (
    <EarningsLayout>
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
          <ExportMenu onExport={exportCSV} />
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
        />
      </div>
    </EarningsLayout>
  );
}
