"use client";

import React from "react";

const stats = [
  { label: "Clips Today" },
  { label: "Viral Accuracy" },
  { label: "Avg Sync Time" },
];

export default function ClipsStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-background/40 backdrop-blur-md border border-white/[0.03] hover:border-brand/20 rounded-[24px] p-6 text-center transition-all duration-500 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-brand/[0.01] group-hover:bg-brand/[0.03] transition-all duration-500" />

          <div className="relative z-10 space-y-1.5">
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-white transition-colors">
              {stat.label}
            </p>
            <p className="text-[13px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Coming soon
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
