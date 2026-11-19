"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";
import { getEarningsData } from "@/lib/queries";
import { useI18n } from "@/components/I18nProvider";

export default function EarningsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["earningsData"],
    queryFn: getEarningsData,
  });

  const totalXlm = data?.totalXlm || "0";
  const tipCount = data?.tipCount || 0;
  const recentTips = data?.recentTips || [];
  
  // Generate mock earnings data for the graph (7 days)
  const earningsGraphData = React.useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const currentTotal = parseFloat(totalXlm);
    return days.map((day, i) => {
      const progress = i / (days.length - 1);
      const value = currentTotal * progress * 0.8;
      return { day, value: value.toFixed(2) };
    });
  }, [totalXlm]);

  const { formatXlm, formatDate: formatDateLocale } = useI18n();

  if (isLoading) {
    return (
      <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 flex items-center justify-center min-h-[140px]">
        <Loader2 className="w-6 h-6 text-[#B6FF4A] animate-spin" />
      </div>
    );
  }

  const formatAddress = (address: string) => {
    if (address.startsWith("G") && address.length === 56) {
      return `${address.slice(0, 6)}…${address.slice(-4)}`;
    }
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    // Absolute date uses Intl.DateTimeFormat with the active locale.
    return formatDateLocale(d, { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 hover:border-[#39FF14]/40 hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B6FF4A]/12 border border-[#B6FF4A]/25 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-[#B6FF4A]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#F4F7EF]">Earnings</h3>
            <p className="text-xs text-[#90A89C]">Stellar tip earnings</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[#B6FF4A] text-xs font-bold">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+12.5%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4">
          <p className="text-[#90A89C] text-xs font-bold uppercase tracking-wider mb-1">Total Earnings</p>
          <p className="text-2xl font-extrabold text-[#F4F7EF]">
            {formatXlm(totalXlm)} <span className="text-sm font-bold text-[#90A89C]">XLM</span>
          </p>
        </div>
        <div className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4">
          <p className="text-[#90A89C] text-xs font-bold uppercase tracking-wider mb-1">Total Tips</p>
          <p className="text-2xl font-extrabold text-[#F4F7EF]">{tipCount}</p>
        </div>
      </div>

      {/* Earnings Graph */}
      <div className="bg-[#042413] border border-[#0e4d2a] rounded-xl p-4 mb-6">
        <p className="text-[#90A89C] text-xs font-bold uppercase tracking-wider mb-4">Earnings This Week</p>
        <div className="relative h-24">
          <svg className="w-full h-full" viewBox="0 0 280 96" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1="0" x2="280" y2="0" stroke="rgba(14,77,42,0.6)" strokeWidth="1" />
            <line x1="0" y1="48" x2="280" y2="48" stroke="rgba(14,77,42,0.6)" strokeWidth="1" />
            <line x1="0" y1="96" x2="280" y2="96" stroke="rgba(14,77,42,0.6)" strokeWidth="1" />
            
            {/* Area fill */}
            <path
              d={`M0,96 L0,${96 - (parseFloat(earningsGraphData[0].value) / (parseFloat(totalXlm) || 1) * 80)} ${earningsGraphData.map((d, i) => {
                const x = (i / (earningsGraphData.length - 1)) * 280;
                const y = 96 - (parseFloat(d.value) / (parseFloat(totalXlm) || 1) * 80);
                return `L${x},${y}`;
              }).join(' ')} L280,96 Z`}
              fill="url(#gradient)"
              opacity="0.35"
            />
            
            {/* Line */}
            <path
              d={`M0,${96 - (parseFloat(earningsGraphData[0].value) / (parseFloat(totalXlm) || 1) * 80)} ${earningsGraphData.map((d, i) => {
                const x = (i / (earningsGraphData.length - 1)) * 280;
                const y = 96 - (parseFloat(d.value) / (parseFloat(totalXlm) || 1) * 80);
                return `L${x},${y}`;
              }).join(' ')}`}
              fill="none"
              stroke="#39FF14"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#39FF14" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#00C853" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Day labels */}
          <div className="flex justify-between mt-2">
            {earningsGraphData.map((d) => (
              <span key={d.day} className="text-[10px] text-[#90A89C] font-medium">
                {d.day}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tips */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#90A89C] uppercase tracking-wider">Recent Tips</p>
          {recentTips.length > 0 && (
            <span className="text-xs text-[#90A89C]">{recentTips.length} tips</span>
          )}
        </div>

        {recentTips.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[#90A89C] text-sm">No tips received yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTips.slice(0, 3).map((tip: any) => (
              <div
                key={tip.id}
                className="flex items-center justify-between p-3 bg-[#042413] border border-[#0e4d2a] rounded-lg hover:border-[#39FF14]/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-[#B6FF4A]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#F4F7EF]">
                      {formatAddress(tip.senderAddress)}
                    </p>
                    <p className="text-[10px] text-[#90A89C]">{formatDate(tip.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-[#B6FF4A]">+{formatXlm(tip.amount)} XLM</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View All Link */}
      {recentTips.length > 3 && (
        <button className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-bold text-[#90A89C] hover:text-[#B6FF4A] transition-colors py-2">
          View all tips
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
