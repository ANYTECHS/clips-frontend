"use client";

import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  trend: string;
  isPositive?: boolean;
  icon: LucideIcon;
}

export default function StatCard({ label, value, trend, isPositive = true, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-[#06351C] border border-[#0e4d2a] rounded-[24px] p-5 sm:p-8 flex flex-col gap-6 relative overflow-hidden group hover:border-[#39FF14]/40 hover:shadow-[0_0_30px_rgba(57,255,20,0.12)] transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[#90A89C] text-[13px] font-bold uppercase tracking-wider">{label}</span>
        <div className="w-10 h-10 rounded-xl bg-[#031d0f] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C] group-hover:text-[#B6FF4A] group-hover:bg-[#B6FF4A]/10 transition-colors">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="flex items-end gap-3">
        <h3 className="text-[32px] font-extrabold text-[#F4F7EF] leading-none font-mono">{value}</h3>
        <div className={`flex items-center gap-1 text-[13px] font-bold pb-1 ${isPositive ? "text-[#B6FF4A]" : "text-rose-500"}`}>
          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{trend}</span>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#39FF14]/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
    </div>
  );
}
