"use client";

import React, { useState, useMemo, useCallback } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ClipGrid from "@/components/projects/ClipGrid";
import SelectionFooter from "@/components/projects/SelectionFooter";
import { X } from "lucide-react";

const mockClips = [
  { id: "1", title: "Clip #01 - The Big Reveal Hook", thumbnail: "/projects/thumb1.png", score: 94, scoreKey: "high", duration: "00:45", style: "Bold & Dynamic", status: "pending" },
  { id: "2", title: "Clip #02 - Technical Deep Dive", thumbnail: "/projects/thumb2.png", score: 68, scoreKey: "medium", duration: "00:58", style: "Minimalist", status: "listed" },
  { id: "3", title: "Clip #03 - Audience Reaction", thumbnail: "/projects/thumb3.png", score: 82, scoreKey: "high", duration: "00:32", style: "Emoji-Rich", status: "pending" },
  { id: "4", title: "Clip #04 - Feature Walkthrough", thumbnail: "/projects/thumb1.png", score: 91, scoreKey: "high", duration: "00:52", style: "Subtitles Only", status: "history" },
  { id: "5", title: "Clip #05 - Closing Remarks", thumbnail: "/projects/thumb2.png", score: 42, scoreKey: "low", duration: "01:12", style: "Minimalist", status: "pending" },
  { id: "6", title: "Clip #06 - Product Detail B-Roll", thumbnail: "/projects/thumb3.png", score: 89, scoreKey: "high", duration: "00:44", style: "Bold & Dynamic", status: "listed" },
];

export default function ProjectsPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMinting, setIsMinting] = useState(false);
  const [captionsStyle, setCaptionsStyle] = useState("All Styles");
  const [viralityLevels, setViralityLevels] = useState<string[]>(["high", "medium", "low"]);
  const [vaultFilter, setVaultFilter] = useState("pending");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filteredClips = useMemo(() => {
    return mockClips.filter(clip => {
      const matchesStyle = captionsStyle === "All Styles" || clip.style === captionsStyle;
      const matchesLevel = viralityLevels.includes(clip.scoreKey);
      const matchesVault = clip.status === vaultFilter;
      return matchesStyle && matchesLevel && matchesVault;
    });
  }, [captionsStyle, viralityLevels, vaultFilter]);

  const activeFilterCount = useMemo(() => {
    return (captionsStyle !== "All Styles" ? 1 : 0) + 
           (viralityLevels.length < 3 ? 1 : 0) + 
           (vaultFilter !== "pending" ? 1 : 0);
  }, [captionsStyle, viralityLevels, vaultFilter]);

  const handleViralityToggle = useCallback((level: string) => {
    setViralityLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  }, []);

  const handleResetFilters = useCallback(() => {
    setCaptionsStyle("All Styles");
    setViralityLevels(["high", "medium", "low"]);
    setVaultFilter("pending");
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.length === filteredClips.length) {
        return [];
      } else {
        return filteredClips.map(c => c.id);
      }
    });
  }, [filteredClips]);

  const handleMint = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    setIsMinting(true);
    try {
      console.log(`Minting NFTs with IDs: ${selectedIds.join(", ")}`);
      // Simulate an API call for minting
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert(`Successfully minted ${selectedIds.length} clip(s)!`);
      setSelectedIds([]); // Clear selection after successful mint
    } catch (error) {
      console.error("Minting failed", error);
      alert("Failed to mint clips");
    } finally {
      setIsMinting(false);
    }
  }, [selectedIds]);

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Background Effects */}
      <div className="fixed top-0 left-0 w-[50vw] h-[50vw] rounded-full bg-brand/5 blur-[120px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-brand/[0.03] rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />

      {/* Mobile Filter Drawer Overlay */}
      {mobileFiltersOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Mobile Filter Drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] bg-[#050505] border-r border-white/5 py-10 pl-8 transition-transform duration-300 lg:hidden ${
        mobileFiltersOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <button
          onClick={() => setMobileFiltersOpen(false)}
          className="absolute top-4 right-4 p-2 text-[#5A6F65] hover:text-white transition-colors"
          aria-label="Close filters"
        >
          <X className="w-5 h-5" />
        </button>
        <ProjectFilters
          captionsStyle={captionsStyle}
          onCaptionsStyleChange={setCaptionsStyle}
          viralityLevels={viralityLevels}
          onViralityLevelToggle={handleViralityToggle}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          vaultFilter={vaultFilter}
          onVaultFilterChange={setVaultFilter}
          mobile
        />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-col sticky top-0 h-screen py-10 pl-10 shrink-0">
        <ProjectFilters
          captionsStyle={captionsStyle}
          onCaptionsStyleChange={setCaptionsStyle}
          viralityLevels={viralityLevels}
          onViralityLevelToggle={handleViralityToggle}
          activeFilterCount={activeFilterCount}
          onResetFilters={handleResetFilters}
          vaultFilter={vaultFilter}
          onVaultFilterChange={setVaultFilter}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen relative z-10 px-4 sm:px-6 lg:px-10 xl:px-16 overflow-hidden min-w-0">
        <DashboardHeader onMenuClick={() => setMobileFiltersOpen(true)} />

        <div className="flex-1 flex flex-col overflow-hidden w-full max-w-[1400px] mx-auto pt-6">
          <div key={vaultFilter} className="flex-1 overflow-y-auto pr-1 scrollbar-hide pb-4 animate-in fade-in duration-500">
            <ClipGrid
              clips={filteredClips}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
            />
          </div>
          
          {/* Docked Actions Footer (now truly always visible and grounded) */}

          <SelectionFooter 
            count={selectedIds.length} 
            onMint={handleMint}
            isMinting={isMinting}
          />

        </div>
      </main>
    </div>
  );
}
