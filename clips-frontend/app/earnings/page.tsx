"use client";

import React, { useState, useEffect } from "react";
import EarningsLayout from "@/components/dashboard/EarningsLayout";
import EarningsTable from "@/components/dashboard/EarningsTable";
import StatCard from "@/components/dashboard/StatCard";
import { Download, DollarSign, TrendingUp, Wallet, ArrowDownToLine, FileText } from "lucide-react";
import { MockApi, type Summary } from "@/app/lib/mockApi";
import { useAuth } from "@/components/AuthProvider";

// PageProps removed (unused)

export default function EarningsPage() {
  const [summary, setSummary] = useState<Summary>({ total: '0.00', completed: '0.00', pending: '0.00' });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function loadData() {
      if (!user?.id) return;
      try {
        setLoading(true);
        const data = await MockApi.getEarningsReport(user.id);
        setSummary(data.summary);
      } catch (error) {
        console.error('Failed to load earnings summary:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const exportCSV = async () => {
    if (!user?.id || loading) return;
    
    try {
      const { transactions } = await MockApi.getEarningsReport(user.id);
      
      const csvContent = [
        ['Date', 'Description', 'Amount', 'Platform', 'Status', 'Tax ID'],
        ...transactions.map(tx => [
          tx.date,
          tx.description,
          tx.amount.toFixed(2),
          tx.platform,
          tx.status,
          tx.taxId
        ])
      ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clipcash-earnings-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <EarningsLayout>
        <div className="space-y-8 p-12">
          <div className="flex items-center gap-3">
            <div className="animate-spin-slow w-6 h-6 rounded-full border-2 border-brand/20 border-t-brand" />
            <span className="text-white font-medium">Loading earnings...</span>
          </div>
        </div>
      </EarningsLayout>
    );
  }

  return (
    <EarningsLayout>
      <div className="space-y-8">
        {/* Page title + Export */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-white leading-tight">
              Earnings & Tax Report
            </h1>
            <p className="text-muted text-[14px] mt-1">
              Complete transaction history for tax reporting. 
              <span className="font-medium text-white">Total: ${summary.total}</span>
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="bg-brand hover:bg-brand-hover text-black px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_30px_rgba(0,229,143,0.3)] active:scale-[0.98] self-start lg:self-auto w-fit whitespace-nowrap"
            disabled={loading}
          >
            <Download className="w-4.5 h-4.5" />
            <FileText className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Dynamic Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Earned" value={`$${summary.total}`} trend="+12.5%" icon={DollarSign} />
          <StatCard label="Completed" value={`$${summary.completed}`} trend="+8.2%" icon={TrendingUp} />
          <StatCard label="Pending Payout" value={`$${summary.pending}`} trend="Processing" icon={Wallet} />
          <StatCard label="Tax Ready" value="✅ Yes" trend="Exportable" icon={FileText} />
        </div>

        {/* Table */}
        <EarningsTable onExport={exportCSV} />
      </div>
    </EarningsLayout>
  );
}
