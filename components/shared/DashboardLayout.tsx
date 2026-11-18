"use client";

import React, { useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import BackgroundGlow from "@/components/shared/BackgroundGlow";

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

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10 ${showSidebar ? "lg:pl-[280px]" : ""}`}>
        {showHeader && <DashboardHeader onMenuClick={handleMenuClick} />}
        {children}
      </main>
    </div>
  );
}
