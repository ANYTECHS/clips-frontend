"use client";

import React, { useState } from "react";
import  DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import PlatformDistribution from "@/components/dashboard/PlatformDistribution";
import AIInsightCard from "@/components/dashboard/AIInsightCard";
import ProjectCard from "@/components/dashboard/ProjectCard";
import EarningsSummaryCards from "@/components/dashboard/EarningsSummaryCards";
import { DollarSign, Video, Globe } from "lucide-react";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Radial Glows */}
      <div className="glow-large fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed top-1/4 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3" />
      
      {/* Sidebar Backdrop Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto scrollbar-hide relative z-10">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="dashboard-main space-y-8 max-w-[1400px] mx-auto w-full">
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard 
              label="Total Earnings" 
              value="$12,450.80" 
              trend="+12.5%" 
              icon={DollarSign} 
            />
            <StatCard 
              label="Clips Posted" 
              value="142" 
              trend="+8.2%" 
              icon={Video} 
            />
            <StatCard 
              label="Active Platforms" 
              value="4" 
              trend="Steady" 
              icon={Globe} 
            />
          </div>

          {/* Earnings Summary Cards */}
          <div className="space-y-4">
            <h3 className="text-[18px] font-extrabold text-white tracking-tight">Earnings Summary</h3>
            <EarningsSummaryCards />
          </div>

          {/* Middle Section: Chart + Platform Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Revenue Chart — spans 2 cols */}
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>

            {/* Platform Distribution — 1 col */}
            <div>
              <PlatformDistribution />
            </div>
          </div>

          {/* AI Insight */}
          <AIInsightCard />

          {/* Bottom Section: Recent Projects */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[20px] font-extrabold text-white tracking-tight">Recent Projects</h3>
              <button className="text-[14px] font-bold text-brand hover:underline">View All</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
              <ProjectCard 
                title="Apex Legends Clutch Moments" 
                clipsCount={2} 
                status="processing"
                thumbnail="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400&h=400"
              />
              <ProjectCard 
                title="React Native Tutorial 2024" 
                clipsCount={12} 
                status="completed"
                thumbnail="https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&q=80&w=400&h=400"
              />
              <ProjectCard 
                title="Weekly Podcast Highlight #42" 
                clipsCount={5} 
                status="completed"
                thumbnail="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400&h=400"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
