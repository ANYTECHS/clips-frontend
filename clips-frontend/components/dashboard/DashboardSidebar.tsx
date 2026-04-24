"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Video, 
  DollarSign, 
  BarChart3, 
  Share2, 
  Settings, 
  Zap,
  ArrowUpRight,
  X,
  Gem
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "projects", label: "Projects", icon: Video, href: "/projects" },
  { id: "vault", label: "NFT Vault", icon: Gem, href: "/vault" },
  { id: "platforms", label: "Platforms", icon: Share2, href: "/platforms" },
  // { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showToast, setShowToast] = useState(false);

  const handleUpgradeClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-[300px] lg:w-[280px] bg-[#050505] border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
      isOpen ? "translate-x-0" : "-translate-x-full"
    } shrink-0 h-screen sticky top-0`}>
      {/* Logo & Close */}
      <div className="p-8 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 text-[20px] font-extrabold tracking-tight text-white group" onClick={onClose}>
          <div className="w-[32px] h-[32px] bg-brand rounded-[10px] flex items-center justify-center text-black text-[18px] group-hover:scale-110 transition-transform">
            ⚡
          </div>
          <span>ClipCash <span className="text-brand">AI</span></span>
        </Link>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-[#5A6F65] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`sidebar-nav-item flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-brand/10 text-brand font-bold" 
                  : "text-[#8e9895] hover:text-white hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-brand" : "text-[#4A5D54] group-hover:text-white"}`} />
              <span className="text-[14px]">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_8px_rgba(0,229,143,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pro Plan Card */}
      <div className="px-6 mb-6">
        <div className="bg-[#0C120F] border border-[#1A2621] rounded-[20px] p-5 relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand/10 blur-[40px] rounded-full pointer-events-none" />
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[10px] font-bold text-brand uppercase tracking-wider mb-1">PRO PLAN</div>
              <div className="text-[14px] font-bold text-white">80% used</div>
            </div>
            <Zap className="w-4 h-4 text-brand fill-brand" />
          </div>

          <div className="w-full h-1.5 bg-[#17201C] rounded-full mb-5 overflow-hidden">
            <div 
              className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(0,229,143,0.5)]" 
              style={{ width: "80%" }} 
            />
          </div>

          <button 
            onClick={handleUpgradeClick}
            className="w-full bg-brand hover:bg-brand-hover text-black py-2.5 rounded-xl font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.95] active:brightness-90 hover:shadow-[0_0_20px_rgba(0,229,143,0.3)]"
          >
            Upgrade Now
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-6 border-t border-white/5 bg-[#080C0B]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-zinc-800">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || user?.email || 'Guest'}`} 
              alt={`${user?.username || user?.name || "User"} avatar`} 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-white truncate">
              {user?.username || user?.name || "Alex Rivera"}
            </div>
            <div className="text-[11px] text-[#5A6F65] truncate">
              {user?.email || "alex@clipcash.ai"}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0C120F] border border-brand/30 rounded-xl px-5 py-4 shadow-[0_0_30px_rgba(0,229,143,0.2)] backdrop-blur-md flex items-center gap-3 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-brand fill-brand" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-white">Upgrade flow coming soon</p>
              <p className="text-[11px] text-[#5A6F65] mt-0.5">We're working on something awesome!</p>
            </div>
            <button 
              onClick={() => setShowToast(false)}
              className="text-[#5A6F65] hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
