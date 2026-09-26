import React from "react";
import Skeleton from "@/components/ui/Skeleton";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background text-white flex flex-col font-sans relative overflow-hidden">
      <BackgroundOrbs variant="default" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-3xl space-y-10">
          <div className="flex flex-col items-center text-center gap-5">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-72 rounded-xl" />
              <Skeleton className="h-4 w-56 rounded-lg" />
            </div>
          </div>

          <div className="bg-surface border border-white/5 rounded-3xl p-8 space-y-7">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-14 rounded-xl" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-32 ml-auto" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}