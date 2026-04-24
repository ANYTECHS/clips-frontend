"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  icon: LucideIcon;
  label?: string;
  labelColor?: string;
}

export default function SectionHeader({ title, icon: Icon, label, labelColor = "text-brand" }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center text-muted-foreground">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h3 className="text-[18px] font-bold text-white tracking-tight">{title}</h3>
      </div>
      
      {label && (
        <div className={`text-[10px] font-black uppercase tracking-[0.15em] ${labelColor} bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/5 shadow-sm`}>
          {label}
        </div>
      )}
    </div>
  );
}
