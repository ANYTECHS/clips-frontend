"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, X } from 'lucide-react';
import { Transaction, MockApi, Summary } from '@/app/lib/mockApi';
import { useAuth } from '@/components/AuthProvider';
import TransactionTable from '@/components/ui/TransactionTable';
import { useEarningsSearch } from '@/app/lib/EarningsSearchContext';
import { useDebounce } from '@/app/lib/useDebounce';

interface EarningsTableProps {
  onExport?: (format: 'csv') => void;
}

export default function EarningsTable({ onExport }: EarningsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: '0.00', completed: '0.00', pending: '0.00' });
  const [loading, setLoading] = useState(true);

  // Local search bar (within the table panel) — kept for table-scoped filtering
  const [localSearch, setLocalSearch] = useState('');

  // Global search from the EarningsLayout header
  const { searchQuery } = useEarningsSearch();

  const { user } = useAuth();

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const { transactions: txs, summary: sum } = await MockApi.getEarningsReport(user.id);
        setTransactions(txs);
        setSummary(sum);
      } catch (error) {
        console.error('Failed to fetch earnings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id]);

  // Debounce both search inputs at 300ms so filtering only runs
  // after the user pauses typing — prevents jank on every keystroke
  const debouncedLocalSearch = useDebounce(localSearch, 300);
  const debouncedGlobalSearch = useDebounce(searchQuery, 300);

  // Combine: global header search takes priority; local search refines further
  const activeTerm = (debouncedGlobalSearch || debouncedLocalSearch).toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!activeTerm) return transactions;

    return transactions.filter(tx => {
      return (
        tx.id.toLowerCase().includes(activeTerm) ||
        tx.description.toLowerCase().includes(activeTerm) ||
        tx.platform.toLowerCase().includes(activeTerm) ||
        tx.status.toLowerCase().includes(activeTerm) ||
        tx.type.toLowerCase().includes(activeTerm) ||
        tx.date.toLowerCase().includes(activeTerm) ||
        tx.taxId.toLowerCase().includes(activeTerm) ||
        tx.amount.toString().includes(activeTerm)
      );
    });
  }, [transactions, activeTerm]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#111111] border border-white/5 rounded-[24px] p-8">
          <div className="text-[#8e9895] text-[13px] font-bold uppercase tracking-wider mb-2">Total Earnings</div>
          <div className="text-[28px] font-extrabold text-white">${summary.total}</div>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-[24px] p-8">
          <div className="text-[#8e9895] text-[13px] font-bold uppercase tracking-wider mb-2">Completed</div>
          <div className="text-[28px] font-extrabold text-brand">${summary.completed}</div>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-[24px] p-8">
          <div className="text-[#8e9895] text-[13px] font-bold uppercase tracking-wider mb-2">Pending</div>
          <div className="text-[28px] font-extrabold text-yellow-400">${summary.pending}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5D54] pointer-events-none" />
            <input
              id="table-search"
              type="text"
              placeholder="Search by ID, platform, status..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full sm:w-72 bg-[#111111] border border-white/5 rounded-xl pl-10 pr-8 py-2.5 text-[14px] text-white placeholder:text-[#4A5D54] focus:border-brand focus:outline-none transition-colors"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D54] hover:text-white transition-colors"
                aria-label="Clear table search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-[#8e9895] text-[13px]">
            {filtered.length} of {transactions.length} transactions
            {activeTerm && (
              <span className="ml-2 text-brand font-medium">
                for &quot;{activeTerm}&quot;
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onExport?.('csv')}
          className="bg-brand hover:bg-brand-hover text-black px-6 py-2.5 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <TransactionTable transactions={filtered} loading={loading} />
    </div>
  );
}
