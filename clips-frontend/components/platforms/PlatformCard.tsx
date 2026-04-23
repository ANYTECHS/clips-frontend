"use client";

import React from "react";
import { LucideIcon, CheckCircle2, MoreHorizontal, Settings, Loader2 } from "lucide-react";

interface PlatformCardProps {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }> | LucideIcon;
  status: "ACTIVE" | "NOT LINKED" | "LINKED";
  ctaText: string;
  username? : string;
  variant?: "vertical" | "horizontal";
  onConnect?: () => void;
  onDisconnect?: () => void;
  isLoading?: boolean;
}

export default function PlatformCard({ name, description, icon: Icon, status, ctaText, username, variant = "vertical", onConnect, onDisconnect, isLoading }: PlatformCardProps) {
  const isActive = status === "ACTIVE" || status === "LINKED";

  if (variant === "horizontal") {
    return (
      <div className="bg-[#111111]/40 backdrop-blur-md border border-white/[0.03] rounded-[24px] p-6 flex items-center justify-between group hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-white/5 flex items-center justify-center text-[#5A6F65] group-hover:text-brand transition-colors">
            <Icon className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h4 className="text-[17px] font-bold text-white tracking-tight">{name}</h4>
            <p className="text-[13px] text-[#5A6F65] font-medium">{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {status === "LINKED" ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-brand uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Linked
              </div>
              <div className="text-[13px] font-mono text-[#3A4A43] bg-white/[0.02] px-2 py-0.5 rounded-lg border border-white/[0.03]">
                {username}
              </div>
              {onDisconnect && (
                <button
                  onClick={onDisconnect}
                  className="text-[11px] text-[#5A6F65] hover:text-red-400 transition-colors mt-0.5 font-medium"
                >
                  Disconnect
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl border border-white/10 text-white font-bold text-[13px] hover:bg-white/[0.05] transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isLoading ? "Connecting..." : ctaText}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111111]/40 backdrop-blur-md border border-white/[0.03] rounded-[24px] p-8 flex flex-col gap-8 group hover:border-brand/20 transition-all duration-300 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="w-16 h-16 rounded-[22px] bg-[#1A1A1A] border border-white/5 flex items-center justify-center text-[#5A6F65] group-hover:text-brand transition-all duration-500 shadow-inner">
          <Icon className="w-8 h-8" />
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.12em] ${
          isActive 
            ? "bg-brand/10 text-brand border border-brand/20 shadow-[0_0_10px_rgba(0,229,143,0.15)]" 
            : "bg-white/[0.03] text-[#5A6F65] border border-white/5"
        }`}>
          {status}
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-[20px] font-bold text-white tracking-tight">{name}</h4>
        <p className="text-[14px] text-[#5A6F65] font-medium leading-relaxed">{username || description}</p>
      </div>

      <button 
        onClick={status === "NOT LINKED" ? onConnect : onDisconnect}
        disabled={isLoading}
        className={`w-full py-4 rounded-xl font-bold text-[14px] transition-all flex items-center justify-center gap-2.5 ${
          status === "NOT LINKED" 
            ? "bg-brand hover:bg-brand-hover text-black shadow-[0_0_20px_rgba(0,229,143,0.2)] hover:shadow-[0_0_35px_rgba(0,229,143,0.35)]" 
            : "bg-transparent border border-white/10 text-white hover:bg-white/[0.05]"
        } active:scale-[0.98] group/btn disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          status === "ACTIVE" && <Settings className="w-4 h-4 text-[#5A6F65] group-hover/btn:text-white transition-colors" />
        )}
        {isLoading ? "Connecting..." : ctaText}
      </button>
    </div>
  );
}
