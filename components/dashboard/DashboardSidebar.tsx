"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Video, 
  Share2, 
  Settings, 
  X,
  LogOut,
  Sparkles,
  Cpu as CpuAi,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/shared/Logo";
import UserAvatar from "@/components/shared/UserAvatar";
import { getUserClipCount } from "@/lib/queries";

const staticMenuItems = [
  { id: "dashboard",         label: "Dashboard",        icon: LayoutDashboard, href: "/dashboard" },
  { id: "analytics",         label: "Analytics",        icon: BarChart3,       href: "/analytics" },
  { id: "ai-projects",       label: "AI Projects",      icon: Sparkles,        href: "/ai-projects" },
  { id: "agent-marketplace", label: "Agent Marketplace",icon: CpuAi,             href: "/agent-marketplace" },
  { id: "platforms",         label: "Auto-Posting",     icon: Share2,          href: "/platforms" },
  { id: "settings",          label: "Settings",         icon: Settings,        href: "/settings" },
];

const projectsItem = { id: "projects", label: "Projects", icon: Video, href: "/projects" };

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardSidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { data: clipCount = 0 } = useQuery({
    queryKey: ["userClipCount"],
    queryFn: getUserClipCount,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const hasClips = clipCount > 0;

  const menuItems = hasClips
    ? [
        staticMenuItems[0],
        staticMenuItems[1],
        projectsItem,
        staticMenuItems[2],
        staticMenuItems[3],
        staticMenuItems[4],
        staticMenuItems[5],
      ]
    : staticMenuItems;

  return (
    <aside className={`fixed top-0 left-0 h-screen w-[280px] bg-[#031d0f] border-r border-[#0e4d2a] z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-8 flex items-center justify-between">
        <Logo />
        <button 
          onClick={onClose}
          className="lg:hidden p-2 -mr-2 text-[#90A89C] hover:text-[#F4F7EF] transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? "bg-[#B6FF4A]/12 text-[#B6FF4A] font-bold border border-[#B6FF4A]/25 shadow-[0_0_15px_rgba(57,255,20,0.08)]" 
                  : "text-[#90A89C] hover:text-[#F4F7EF] hover:bg-[#06351C]/60"
              }`}
            >
              <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-[#B6FF4A]" : "text-[#5A7A6B] group-hover:text-[#F4F7EF]"}`} />
              <span className="text-[14px]">{item.label}</span>
              {item.id === "projects" && hasClips && (
                <span className="ml-auto px-1.5 py-0.5 rounded-md bg-[#B6FF4A]/15 text-[#B6FF4A] text-[9px] font-black tracking-wider">
                  {clipCount > 99 ? "99+" : clipCount}
                </span>
              )}
              {item.id === "platforms" && (
                <span className="ml-auto px-2 py-0.5 rounded-full bg-[#B6FF4A]/10 border border-[#B6FF4A]/20 text-[#B6FF4A] text-[9px] font-black uppercase tracking-wider">
                  Coming Soon
                </span>
              )}
              {isActive && item.id !== "projects" && item.id !== "platforms" && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-6 border-t border-[#0e4d2a] bg-[#020D08]/60">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#F4F7EF] truncate">
              {user?.username || user?.profile?.username || user?.fullName || ""}
            </div>
            <div className="text-[11px] text-[#90A89C] truncate">
              {user?.email || ""}
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="p-2 text-[#90A89C] hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10 group/logout relative"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#042413] text-[#F4F7EF] text-[10px] rounded opacity-0 group-hover/logout:opacity-100 transition-opacity whitespace-nowrap border border-[#0e4d2a] pointer-events-none">
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
