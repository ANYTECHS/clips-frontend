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
          className="bg-[#06351C] backdrop-blur-md border border-[#0e4d2a] hover:border-[#39FF14]/40 rounded-[24px] p-6 text-center transition-all duration-500 group relative overflow-hidden"
        >
          {/* Subtle Glow Background */}
          <div className="absolute inset-0 bg-[#39FF14]/[0.02] group-hover:bg-[#39FF14]/[0.05] transition-all duration-500" />
          
          <div className="relative z-10 space-y-1.5">
            <p className="text-[28px] sm:text-[32px] font-black text-[#F4F7EF] group-hover:text-[#B6FF4A] transition-colors tracking-tight">
              {stat.value}
            </p>
            <p className="text-[12px] font-bold text-[#90A89C] uppercase tracking-wider group-hover:text-[#F4F7EF] transition-colors">
              {stat.label}
            </p>
            <div className="pt-3 border-t border-[#0e4d2a] mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
               <p className="text-[10px] font-medium text-[#90A89C] uppercase tracking-widest">{stat.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
