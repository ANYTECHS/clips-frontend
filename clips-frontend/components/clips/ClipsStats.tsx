"use client";

import React from "react";

export default function ClipsStats() {
  const stats = [
    { label: "Clips Today", value: "4.8k", detail: "Viral potential detected" },
    { label: "Viral Accuracy", value: "98%", detail: "AI engine confidence" },
    { label: "Avg Sync Time", value: "2.1s", detail: "Fastest in the industry" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <div 
          key={stat.label}
          className="bg-background/40 backdrop-blur-md border border-white/[0.03] hover:border-brand/20 rounded-[24px] p-6 text-center transition-all duration-500 group relative overflow-hidden"
        >
          {/* Subtle Glow Background */}
          <div className="absolute inset-0 bg-brand/[0.01] group-hover:bg-brand/[0.03] transition-all duration-500" />
          
          <div className="relative z-10 space-y-1.5">
            <p className="text-[28px] sm:text-[32px] font-black text-white group-hover:text-brand transition-colors tracking-tight">
              {stat.value}
            </p>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-white transition-colors">
              {stat.label}
            </p>
            <div className="pt-3 border-t border-white/[0.03] mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
               <p className="text-[10px] font-medium text-subtle uppercase tracking-widest">{stat.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
