"use client";

import "./dashboard.css";
import React, {
  useState,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from "react";
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

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  // An inline object literal here would be a new value on every layout render,
  // re-rendering every `useSidebar()` consumer even when the flag is unchanged.
  const sidebarContext = useMemo(
    () => ({ sidebarOpen, setSidebarOpen }),
    [sidebarOpen],
  );

  return (
    <SidebarContext.Provider value={sidebarContext}>
      <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
        <BackgroundOrbs variant="default" />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={closeSidebar}
          />
        )}

        <DashboardSidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
          <DashboardHeader onMenuClick={openSidebar} />
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
