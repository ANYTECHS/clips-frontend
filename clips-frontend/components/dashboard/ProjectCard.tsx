"use client";

import React from "react";
import { Play } from "lucide-react";

interface ProjectCardProps {
  title: string;
  clipsCount: number;
  status: "processing" | "completed";
  thumbnail: string;
}

export default function ProjectCard({ title, clipsCount, status, thumbnail }: ProjectCardProps) {
  return (
    <div className="bg-surface border border-border rounded-[24px] p-5 flex items-center gap-5 group hover:border-white/10 transition-all duration-300">
      <div className="w-24 h-24 rounded-[18px] overflow-hidden relative shrink-0">
        <img src={thumbnail} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-brand/90 flex items-center justify-center text-black">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <h4 className="text-[15px] font-bold text-white truncate group-hover:text-brand transition-colors">
          {title}
        </h4>
        <p className="text-[12px] text-muted-foreground font-medium">
          {clipsCount} clips generated
        </p>
        
        <div className="flex">
          <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${
            status === "processing" 
              ? "bg-brand/10 text-brand border border-brand/20 shadow-[0_0_10px_rgba(0,229,143,0.15)]" 
              : "bg-white/[0.03] text-muted border border-border"
          }`}>
            {status}
          </div>
        </div>
      </div>
    </div>
  );
}
