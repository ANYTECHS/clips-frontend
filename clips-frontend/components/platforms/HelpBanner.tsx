"use client";

import React from "react";
import { HelpCircle, ArrowRight } from "lucide-react";

export default function HelpBanner() {
  return (
    <div className="relative group overflow-hidden rounded-[28px] p-[1px] bg-gradient-to-r from-brand/50 via-brand/10 to-transparent">
      <div className="bg-background rounded-[27px] p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden border border-brand/10">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand/5 blur-[120px] rounded-full pointer-events-none -translate-x-1/4 -translate-y-1/2" />
        
        <div className="space-y-2 relative z-10 text-center md:text-left">
          <h4 className="text-[22px] font-extrabold text-white tracking-tight">Need help connecting?</h4>
          <p className="text-muted-foreground text-[16px] font-medium leading-relaxed max-w-lg">Our support team is available 24/7 to help you set up your automated clipping workflow.</p>
        </div>

        <button className="flex items-center gap-2.5 text-[18px] font-bold text-brand hover:text-brand-hover transition-all group relative z-10 whitespace-nowrap active:scale-[0.98]">
          Contact Support
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
