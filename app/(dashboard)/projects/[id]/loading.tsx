import React from "react";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-white/10 animate-pulse" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-4 w-16 bg-white/5 rounded animate-pulse mt-2" />
        </div>
      </div>

      <div className="relative aspect-video max-w-2xl rounded-2xl overflow-hidden bg-white/10 animate-pulse" />

      <div>
        <div className="h-6 w-32 bg-white/10 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div className="aspect-[9/16] bg-white/10 animate-pulse" />
              <div className="p-3">
                <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
