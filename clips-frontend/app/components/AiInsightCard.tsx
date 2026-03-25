import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function AiInsightCard() {
  return (
    <div className="max-w-sm rounded-2xl border border-[#1B3A2E] bg-gradient-to-br from-[#0B1E16] to-[#05100B] p-6 shadow-xl font-sans">
      {/* Header with Stars Icon */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1DB954]/20 text-[#1DB954]">
          <Sparkles size={18} />
        </div>
        <h3 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
          AI Insight
        </h3>
      </div>

      {/* Description */}
      <p className="mb-6 text-[15px] leading-relaxed text-zinc-100">
        Your engagement peaked at <span className="text-[#1DB954] font-medium">8:45 PM</span>. Consider posting similar content during this window to maximize your reach.
      </p>

      {/* Link with Green Arrow */}
      <a 
        href="#" 
        className="group flex items-center gap-2 text-sm font-semibold text-[#1DB954] transition-all hover:opacity-80"
      >
        Explore full analytics
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
      </a>
    </div>
  );
}
