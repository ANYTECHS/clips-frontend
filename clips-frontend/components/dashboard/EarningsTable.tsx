"use client";

import React, { useState, useMemo } from "react";
import { Download, Search, X, ChevronDown } from "lucide-react";
import { Transaction, Summary } from "@/app/lib/mockApi";
import TransactionTable from "@/components/ui/TransactionTable";
import { useEarningsSearch } from "@/app/lib/EarningsSearchContext";
import { useDebounce } from "@/app/lib/useDebounce";

interface EarningsTableProps {
  transactions: Transaction[];
  summary: Summary;
  loading: boolean;
  onExport?: (format: "csv" | "json" | "pdf") => void;
}

export default function EarningsTable({
  transactions,
  summary,
  loading,
  onExport,
}: EarningsTableProps) {
  const [localSearch, setLocalSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const { searchQuery } = useEarningsSearch();

  const debouncedLocalSearch = useDebounce(localSearch, 300);
  const debouncedGlobalSearch = useDebounce(searchQuery, 300);

  const globalSearchActive = debouncedGlobalSearch.toLowerCase().trim().length > 0;
  const localSearchActive = debouncedLocalSearch.toLowerCase().trim().length > 0;

  // Close export dropdown on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Helper function to check if transaction matches a search term
  const matchesSearchTerm = (tx: Transaction, term: string): boolean => {
    const lowerTerm = term.toLowerCase();
    return (
      tx.id.toLowerCase().includes(lowerTerm) ||
      tx.description.toLowerCase().includes(lowerTerm) ||
      tx.platform.toLowerCase().includes(lowerTerm) ||
      tx.status.toLowerCase().includes(lowerTerm) ||
      tx.type.toLowerCase().includes(lowerTerm) ||
      tx.date.toLowerCase().includes(lowerTerm) ||
      tx.taxId.toLowerCase().includes(lowerTerm) ||
      tx.amount.toString().includes(lowerTerm)
    );
  };

  const filtered = useMemo(() => {
    const globalTerm = debouncedGlobalSearch.toLowerCase().trim();
    const localTerm = debouncedLocalSearch.toLowerCase().trim();

    // If no searches are active, return all transactions
    if (!globalTerm && !localTerm) return transactions;

    // Apply AND logic: transaction must match both searches if both are active
    return transactions.filter((tx) => {
      const matchesGlobal = globalTerm === "" || matchesSearchTerm(tx, globalTerm);
      const matchesLocal = localTerm === "" || matchesSearchTerm(tx, localTerm);
      return matchesGlobal && matchesLocal;
    });
  }, [transactions, debouncedGlobalSearch, debouncedLocalSearch]);

  return (
    <div className="space-y-6">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">
            Total Earnings
          </div>
          <div className="text-[28px] font-extrabold text-white">
            ${summary.total}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">
            Completed
          </div>
          <div className="text-[28px] font-extrabold text-brand">
            ${summary.completed}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">
            Pending
          </div>
          <div className="text-[28px] font-extrabold text-warning">
            ${summary.pending}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col gap-3 items-start flex-1">
          {/* Search Input Section */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1 w-full">
            {/* Global Search Badge (if active) */}
            {globalSearchActive && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand/20 border border-brand/40 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-[12px] font-medium text-brand">Global search active</span>
              </div>
            )}

            {/* Local Table Search Input */}
            <div className="relative" title={globalSearchActive ? "Refine results with table search (global search is active)" : undefined}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                id="table-search"
                type="text"
                placeholder={globalSearchActive ? "Refine results..." : "Search by ID, platform, status..."}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                disabled={false}
                className={`w-full sm:w-72 bg-[#111111] border rounded-xl pl-10 pr-8 py-2.5 text-[14px] text-white placeholder:text-[#4A5D54] focus:border-brand focus:outline-none transition-colors ${
                  globalSearchActive
                    ? "border-brand/30 bg-brand/5 opacity-80"
                    : "border-white/5"
                }`}
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D54] hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Summary */}
          {(globalSearchActive || localSearchActive) && (
            <div className="flex flex-col sm:flex-row gap-2 items-start text-[12px] text-muted">
              <span>Filters applied:</span>
              <div className="flex flex-wrap gap-2">
                {globalSearchActive && (
                  <span className="px-2 py-1 bg-white/5 rounded border border-white/10">
                    Global: <span className="text-white font-medium">"{debouncedGlobalSearch}"</span>
                  </span>
                )}
                {localSearchActive && (
                  <span className="px-2 py-1 bg-white/5 rounded border border-white/10">
                    Table: <span className="text-white font-medium">"{debouncedLocalSearch}"</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-muted text-[13px]">
            {filtered.length} of {transactions.length} transactions
          </div>
        </div>
        <div ref={exportRef} className="relative">
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="bg-brand hover:bg-brand-hover text-black px-6 py-2.5 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exportOpen ? "rotate-180" : ""}`} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#0C120F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              {(["csv", "json", "pdf"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => { onExport?.(fmt); setExportOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-[13px] font-bold text-white uppercase">{fmt}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmt === "csv" ? "Spreadsheet" : fmt === "json" ? "Developer / API" : "Tax / Accountant"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 && (globalSearchActive || localSearchActive) ? (
        <div className="bg-surface border border-border rounded-[24px] p-12 text-center animate-in fade-in duration-300">
          <p className="text-muted text-[15px] mb-4">
            No transactions match your search filters
          </p>
          <div className="flex flex-col gap-2 mb-6 text-sm text-muted">
            {globalSearchActive && (
              <p>
                Global search: <span className="text-white font-medium">"{debouncedGlobalSearch}"</span>
              </p>
            )}
            {localSearchActive && (
              <p>
                Table search: <span className="text-white font-medium">"{debouncedLocalSearch}"</span>
              </p>
            )}
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            {localSearchActive && (
              <button 
                onClick={() => { setLocalSearch(""); }}
                className="text-brand hover:underline text-sm font-medium"
              >
                Clear table search
              </button>
            )}
            {globalSearchActive && localSearchActive && (
              <span className="text-muted">or</span>
            )}
            {globalSearchActive && (
              <button 
                onClick={() => { setLocalSearch(""); }}
                className="text-brand hover:underline text-sm font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <TransactionTable transactions={filtered} loading={loading} />
      )}
    </div>
  );
}
