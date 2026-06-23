"use client";

import React, { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useFilterQueryState } from "@/hooks/useFilterQueryState";
import type { Transaction, Summary } from "@/app/lib/mockApi";

interface EarningsTableProps {
  transactions: Transaction[];
  summary: Summary;
  loading?: boolean;
  onFilteredTransactionsChange?: (filtered: Transaction[]) => void;
  /** Pagination from the parent (server-driven). When provided, renders prev/next controls. */
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  onPageChange?: (page: number) => void;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "text-green-400",
  pending: "text-yellow-400",
  failed: "text-red-400",
};

export default function EarningsTable({
  transactions,
  summary,
  loading = false,
  onFilteredTransactionsChange,
  pagination,
  onPageChange,
}: EarningsTableProps) {
  const { filters, updateFilters, resetFilters } = useFilterQueryState({
    search: "",
    startDate: "",
    endDate: "",
  });

  const { search, startDate, endDate } = filters;

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !tx.description.toLowerCase().includes(q) &&
          !tx.id.toLowerCase().includes(q) &&
          !tx.platform.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [transactions, search, startDate, endDate]);

  useEffect(() => {
    onFilteredTransactionsChange?.(filtered);
  }, [filtered, onFilteredTransactionsChange]);

  const hasDates = startDate || endDate;

  return (
    <div className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-white/5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            placeholder="Search by ID, description or platform"
            className="w-full bg-input text-white text-sm rounded-xl px-4 py-2.5 pr-8 border border-white/10 placeholder:text-muted-foreground focus:outline-none focus:border-brand/50"
          />
          {search && (
            <button
              onClick={() => updateFilters({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            From
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
              className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-brand/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            To
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
              className="bg-input text-white text-sm rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-brand/50"
            />
          </label>
          {hasDates && (
            <button
              onClick={() => resetFilters()}
              className="text-xs text-muted-foreground hover:text-white underline pb-2"
            >
              Clear dates
            </button>
          )}
        </div>

        {/* Count */}
        <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-muted-foreground text-[11px] uppercase tracking-widest">
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Description</th>
              <th className="px-5 py-3 text-left">Platform</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Tax ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-4 rounded bg-white/6 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => (
                <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 text-muted-foreground">{tx.date}</td>
                  <td className="px-5 py-3.5 text-white">{tx.description}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{tx.platform}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-white">
                    ${tx.amount.toFixed(2)}
                    {tx.cryptoAmount && (
                      <span className="block text-[11px] text-muted-foreground font-normal">
                        {tx.cryptoAmount} {tx.cryptoCurrency}
                      </span>
                    )}
                  </td>
                  <td className={`px-5 py-3.5 font-semibold capitalize ${STATUS_STYLES[tx.status] ?? ""}`}>
                    {tx.status}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-[12px]">{tx.taxId}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-white/10 bg-surface hover:bg-input disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <span className="text-sm text-muted-foreground">
            Page{" "}
            <span className="font-bold text-white">{pagination.page}</span>
            {" "}of{" "}
            <span className="font-bold text-white">{pagination.totalPages}</span>
            <span className="ml-2 text-[12px]">({pagination.total} total)</span>
          </span>

          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border border-white/10 bg-surface hover:bg-input disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
