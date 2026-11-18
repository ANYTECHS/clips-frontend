"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  icon: LucideIcon;
  label?: string;
  labelColor?: string;
}

export default function SectionHeader({ title, icon: Icon, label, labelColor = "text-[#B6FF4A]" }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#042413] border border-[#0e4d2a] flex items-center justify-center text-[#90A89C]">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h3 className="text-[18px] font-bold text-[#F4F7EF] tracking-tight">{title}</h3>
      </div>
      
      {label && (
        <div className={`text-[10px] font-black uppercase tracking-[0.15em] ${labelColor} bg-[#042413] px-3 py-1.5 rounded-full border border-[#0e4d2a] shadow-sm`}>
          {label}
        </div>
      )}
    </div>
  );
}
