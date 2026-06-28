"use client";

import React from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default function EarningsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-white font-sans">
      <DashboardHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10">{children}</main>
    </div>
  );
}
