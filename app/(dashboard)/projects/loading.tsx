import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      <div className="hidden lg:flex flex-col sticky top-0 h-screen py-10 pl-10 shrink-0 w-[240px]">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
          </div>
        </div>
      </div>
      <main className="flex-1 flex flex-col h-screen relative z-10 px-4 sm:px-6 lg:px-10 xl:px-16 overflow-hidden min-w-0 pt-6">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-[24px] p-4 flex flex-col gap-4">
              <Skeleton className="w-full aspect-[9/16] rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
