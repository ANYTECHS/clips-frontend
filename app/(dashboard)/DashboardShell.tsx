"use client";

/**
 * DashboardShell — client-side interactive shell for the dashboard layout.
 *
 * Owns everything that requires browser APIs or React state:
 *  - Sidebar open/close state + SidebarContext
 *  - Service health polling (DegradedModeBanner)
 *
 * Kept in a dedicated file so the parent layout.tsx can be a Server Component
 * that handles auth redirection and passes static session data down the tree.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  createContext,
  useContext,
  useEffect,
} from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import DegradedModeBanner from "@/app/components/DegradedModeBanner";
import { useServiceHealth } from "@/app/hooks/useServiceHealth";
import { warmCriticalData } from "@/app/lib/cache/warmCriticalData";

// ─── Sidebar context ──────────────────────────────────────────────────────────

interface SidebarContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  sidebarOpen: false,
  setSidebarOpen: () => {},
});

export function useSidebar(): SidebarContextType {
  return useContext(SidebarContext);
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { degraded, services, lastCheckedAt, refresh } = useServiceHealth();

  useEffect(() => {
    const controller = new AbortController();
    void warmCriticalData(controller.signal).catch(() => {
      // The dashboard's normal consumer will retry if warming fails.
    });
    return () => controller.abort();
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar  = useCallback(() => setSidebarOpen(true),  []);

  // Stabilise the context value so consumers only re-render when the flag changes.
  const sidebarContext = useMemo(
    () => ({ sidebarOpen, setSidebarOpen }),
    [sidebarOpen],
  );

  return (
    <SidebarContext.Provider value={sidebarContext}>
      <div className="flex min-h-screen bg-background text-white font-sans overflow-hidden">
        <BackgroundOrbs variant="default" />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={closeSidebar}
          />
        )}

        <DashboardSidebar isOpen={sidebarOpen} onClose={closeSidebar} />

        <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
          <DashboardHeader onMenuClick={openSidebar} />

          {degraded && (
            <DegradedModeBanner
              services={services}
              onRefresh={refresh}
              lastCheckedAt={lastCheckedAt}
            />
          )}

          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
