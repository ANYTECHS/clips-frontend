import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      <div className="hidden lg:flex flex-col sticky top-0 h-screen py-10 pl-10 shrink-0 w-64 border-r border-white/5">
        <Skeleton className="w-full h-8 mb-6" />
        <Skeleton className="w-full h-10 mb-2" />
        <Skeleton className="w-full h-10 mb-2" />
        <Skeleton className="w-full h-10 mb-2" />
        <Skeleton className="w-full h-10 mb-2" />
      </div>
      <main className="flex-1 flex flex-col h-screen relative z-10 px-4 sm:px-6 lg:px-10 xl:px-16 overflow-hidden min-w-0 pt-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="mt-8">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
