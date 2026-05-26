"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

export default function AIInsightCard() {
  const router = useRouter();

  return (
    <div className="bg-surface border border-brand/20 rounded-[28px] p-8 flex flex-col gap-6 relative overflow-hidden group shadow-[0_0_40px_rgba(0,229,143,0.05)]">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-brand/10 blur-[60px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand/5 blur-[50px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2" />
      
      <div className="flex items-center gap-3 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
          <Sparkles className="w-5 h-5 fill-brand/20" />
        </div>
        <h3 className="text-[18px] font-bold text-white tracking-tight">AI Insight</h3>
      </div>

      <div className="space-y-4 relative z-10">
        <p className="text-muted text-[15px] leading-[1.6] italic">
          🔮 <span className="text-brand font-bold">Coming Soon</span> — We're analyzing your clip performance data to deliver personalized insights and recommendations tailored to your audience.
        </p>
        
        <button 
          onClick={() => router.push('/dashboard/analytics')}
          className="flex items-center gap-2 text-[14px] font-bold text-brand hover:text-brand-hover transition-colors group/btn"
        >
          View Analytics
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Decorative pulse */}
      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand animate-ping opacity-20" />
    </div>
  );
}
