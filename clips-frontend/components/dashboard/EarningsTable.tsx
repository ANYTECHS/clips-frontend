"use client";

import React, { useState, useEffect } from 'react';
import { Download, Search } from 'lucide-react';
import { Transaction, MockApi, Summary } from '@/app/lib/mockApi';
import { useAuth } from '@/components/AuthProvider';
import TransactionTable from '@/components/ui/TransactionTable';

interface EarningsTableProps {
  onExport?: (format: 'csv') => void;
}

export default function EarningsTable({ onExport }: EarningsTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: '0.00', completed: '0.00', pending: '0.00' });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filtered = transactions.filter(tx =>
    tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">Total Earnings</div>
          <div className="text-[28px] font-extrabold text-white">${summary.total}</div>
        </div>
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">Completed</div>
          <div className="text-[28px] font-extrabold text-brand">${summary.completed}</div>
        </div>
        <div className="bg-surface border border-border rounded-[24px] p-8">
          <div className="text-muted text-[13px] font-bold uppercase tracking-wider mb-2">Pending</div>
          <div className="text-[28px] font-extrabold text-warning">${summary.pending}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by ID, platform, status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 bg-input border border-border rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-white placeholder:text-muted-foreground focus:border-brand focus:outline-none transition-colors"
            />
          </div>
          <div className="text-muted text-[13px]">
            {filtered.length} of {transactions.length} transactions
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
