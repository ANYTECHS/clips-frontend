"use client";

import React from "react";
import { Clock, Check, Tag } from "lucide-react";

interface VaultSidebarProps {
  activeFilter: "pending" | "listed" | "history";
  onFilterChange: (filter: "pending" | "listed" | "history") => void;
}

const filters = [
  {
    id: "pending" as const,
    label: "Pending Mint",
    icon: Clock,
    description: "NFTs waiting to be minted",
    count: 12,
  },
  {
    id: "listed" as const,
    label: "Listed",
    icon: Tag,
    description: "Currently for sale",
    count: 24,
  },
  {
    id: "history" as const,
    label: "History",
    icon: Check,
    description: "Minted NFTs",
    count: 156,
  },
];

export default function VaultSidebar({ activeFilter, onFilterChange }: VaultSidebarProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-wider mb-4 px-4">Filter by Status</h3>
        <nav className="space-y-2">
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;
            const Icon = filter.icon;
            
            return (
              <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                className={`w-full px-4 py-4 rounded-xl transition-all duration-200 group text-left ${
                  isActive
                    ? "bg-brand/10 border border-brand/30"
                    : "border border-border hover:border-border hover:bg-surface-hover"
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? "text-brand" : "text-subtle group-hover:text-muted"
                  }`} />
                  <span className={`text-[14px] font-bold ${
                    isActive ? "text-brand" : "text-white"
                  }`}>
                    {filter.label}
                  </span>
                  <span className={`ml-auto text-[12px] font-bold px-2.5 py-0.5 rounded-lg ${
                    isActive 
                      ? "bg-brand/20 text-brand" 
                      : "bg-surface-hover text-muted"
                  }`}>
                    {filter.count}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground group-hover:text-muted transition-colors">{filter.description}</p>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Stats Card */}
      <div className="mt-8 pt-8 border-t border-border">
        <div className="bg-surface border border-border rounded-[16px] p-4">
          <div className="text-[12px] font-bold text-brand uppercase tracking-wider mb-3">Vault Stats</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Total NFTs</span>
              <span className="text-[14px] font-bold text-white">192</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Total Value</span>
              <span className="text-[14px] font-bold text-brand">$45,320.80</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">Floor Price</span>
              <span className="text-[14px] font-bold text-white">2.5 ETH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
