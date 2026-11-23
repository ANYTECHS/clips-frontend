"use client";

import React, { useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import BackgroundGlow from "@/components/shared/BackgroundGlow";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

interface DashboardLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showSidebar?: boolean;
  onMenuClick?: () => void;
}

export default function DashboardLayout({ 
  children, 
  showHeader = true,
  showSidebar = true,
  onMenuClick
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuClick = onMenuClick || (() => setSidebarOpen(true));

  return (
    <div className="flex min-h-screen bg-[#020D08] text-[#F4F7EF] font-sans overflow-hidden">
      <BackgroundGlow variant="dashboard" />
      
      {/* Sidebar Backdrop Overlay (Mobile) */}
      {(sidebarOpen || (onMenuClick && sidebarOpen)) && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {showSidebar && <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

      {/* Main Content Area — bottom padding keeps content clear of the mobile tab bar */}
      <main className={`flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10 ${showSidebar ? "lg:ps-[280px] pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0" : ""}`}>
        {showHeader && <DashboardHeader onMenuClick={handleMenuClick} menuOpen={sidebarOpen} />}
        <div className="px-4 sm:px-6 lg:px-8 pt-2 w-full max-w-[1400px] mx-auto">
          <Breadcrumbs />
        </div>
        {children}
      </main>

      {/* Bottom tab bar (< 768px) */}
      {showSidebar && <MobileBottomNav />}
    </div>
  );
}
