import React from "react";

export default function AnalyticsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="h-10 w-48 bg-white/10 rounded-xl animate-pulse mb-2" />
            <div className="h-5 w-72 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-32 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-10 w-32 bg-white/10 rounded-xl animate-pulse" />
            <div className="h-10 w-24 bg-brand/20 rounded-xl animate-pulse" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/10 animate-pulse" />
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-white/10 animate-pulse" />
          <div className="h-64 rounded-2xl bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
