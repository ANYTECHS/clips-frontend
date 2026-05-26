"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Copy, Check } from "lucide-react";
import { Transaction } from "@/app/lib/mockApi";
import StatusBadge from "./StatusBadge";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUSD(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatCrypto(amount: number, currency: string) {
  return `${amount.toFixed(4)} ${currency}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const typeColors: Record<Transaction["type"], string> = {
  payout: "text-brand bg-brand/10",
  royalty: "text-purple-400 bg-purple-500/10",
  mint: "text-blue-400 bg-blue-500/10",
  referral: "text-orange-400 bg-orange-500/10",
};

// ─── Copy ID Button ───────────────────────────────────────────────────────────

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 group"
      title="Copy transaction ID"
    >
      <span className="font-mono text-[12px] text-muted group-hover:text-white transition-colors">
        {id}
      </span>
      {copied ? (
        <Check className="w-3 h-3 text-brand shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-subtle group-hover:text-muted shrink-0 transition-colors" />
      )}
    </button>
  );
}

// ─── Sort Header ─────────────────────────────────────────────────────────────

type SortKey = "date" | "amount" | "platform" | "status" | "type" | "description";

function SortTh({
  label,
  sortKey,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <th
      className={`py-4 px-4 text-left font-bold text-[12px] text-muted uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="flex flex-col -space-y-0.5">
          {active && dir === "asc" ? (
            <ChevronUp className="w-2.5 h-2.5 text-brand" />
          ) : active && dir === "desc" ? (
            <ChevronDown className="w-2.5 h-2.5 text-brand" />
          ) : (
            <div className="w-2.5 h-2.5" /> // Spacer to keep alignment
          )}
        </span>
      </span>
    </th>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface TransactionTableProps {
  transactions: Transaction[];
  itemsPerPage?: number;
  loading?: boolean;
}

export default function TransactionTable({
  transactions,
  itemsPerPage = 10,
  loading = false,
}: TransactionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "date":
          av = new Date(a.date).getTime();
          bv = new Date(b.date).getTime();
          break;
        case "amount":
          av = a.amount;
          bv = b.amount;
          break;
        case "platform":
          av = a.platform;
          bv = b.platform;
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "type":
          av = a.type;
          bv = b.type;
          break;
        case "description":
          av = a.description;
          bv = b.description;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [transactions, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const paginated = sorted.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-[24px] p-12 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand/20 border-t-brand animate-spin-slow" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-[24px] p-12 text-center">
        <p className="text-subtle text-[15px]">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-[24px] overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-4 pl-6 pr-4 text-left font-bold text-[12px] text-muted uppercase tracking-wider whitespace-nowrap">
                Transaction ID
              </th>
              <SortTh label="Date" sortKey="date" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Description / Type" sortKey="description" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Status" sortKey="status" current={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="Amount" sortKey="amount" current={sortKey} dir={sortDir} onSort={handleSort} className="text-right pr-6" />
            </tr>
          </thead>
          <tbody>
            {paginated.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-border hover:bg-surface-hover transition-colors"
              >
                {/* Transaction ID */}
                <td className="py-4 pl-6 pr-4">
                  <CopyId id={tx.id} />
                </td>

                {/* Date */}
                <td className="py-4 px-4 text-[13px] text-white whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>

                {/* Platform / Type */}
                <td className="py-4 px-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-white line-clamp-1">{tx.description}</span>
                    <span
                      className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeColors[tx.type]}`}
                    >
                      {tx.type}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="py-4 px-4">
                  <StatusBadge status={tx.status} />
                </td>

                {/* Amount */}
                <td className="py-4 px-4 pr-6 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[14px] font-bold text-white">
                      {formatUSD(tx.amount)}
                    </span>
                    {tx.cryptoAmount && tx.cryptoCurrency && (
                      <span className="text-[11px] text-muted font-mono">
                        {formatCrypto(tx.cryptoAmount, tx.cryptoCurrency)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden divide-y divide-border">
        {paginated.map((tx) => (
          <div key={tx.id} className="p-4 hover:bg-surface-hover transition-colors">
            <div className="flex items-start justify-between gap-3 mb-2">
              <CopyId id={tx.id} />
              <StatusBadge status={tx.status} size="sm" />
            </div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white">{tx.platform}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeColors[tx.type]}`}
                >
                  {tx.type}
                </span>
              </div>
              <span className="text-[12px] text-muted">{formatDate(tx.date)}</span>
            </div>
            <div className="flex items-end justify-between mt-2">
              <span className="text-[13px] text-muted truncate max-w-[180px]">
                {tx.description}
              </span>
              <div className="text-right shrink-0 ml-2">
                <div className="text-[15px] font-bold text-white">{formatUSD(tx.amount)}</div>
                {tx.cryptoAmount && tx.cryptoCurrency && (
                  <div className="text-[11px] text-muted font-mono">
                    {formatCrypto(tx.cryptoAmount, tx.cryptoCurrency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-[12px] text-muted">
            {(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, sorted.length)} of{" "}
            {sorted.length}
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-8 h-8 rounded-lg bg-surface-hover border border-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg border text-[12px] font-bold transition-colors ${
                    p === page
                      ? "bg-brand/10 border-brand/30 text-brand"
                      : "bg-surface-hover border-border text-muted hover:text-white hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="w-8 h-8 rounded-lg bg-surface-hover border border-border disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-muted hover:text-white hover:bg-white/10 transition-colors text-sm"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
