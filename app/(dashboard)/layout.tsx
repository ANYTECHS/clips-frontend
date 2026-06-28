"use client";

import React, { useState, createContext, useContext } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

interface SidebarContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
        <BackgroundOrbs variant="default" />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <DashboardSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
