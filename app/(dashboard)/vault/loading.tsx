import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
      <div className="hidden lg:flex flex-col sticky top-0 h-screen py-10 pl-10 shrink-0 w-[240px]">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
            <Skeleton className="h-10 w-full rounded-xl mb-2" />
          </div>
        </div>
      </div>
      <main className="flex-1 flex flex-col h-screen relative z-10 px-4 sm:px-6 lg:px-10 xl:px-16 overflow-hidden min-w-0 pt-6">
        <div className="flex flex-col gap-2 mb-8">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-3">
                  <Skeleton className="w-full aspect-square rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block w-96 shrink-0">
            <Skeleton className="h-[500px] w-full rounded-[20px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
