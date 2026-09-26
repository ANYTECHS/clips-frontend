"use client";

import React from "react";
import { Filter, RefreshCw } from "lucide-react";
import TagsFilter from "./TagsFilter";

export interface ProjectFiltersProps {
  captionsStyle: string;
  onCaptionsStyleChange: (style: string) => void;
  viralityLevels: string[];
  onViralityLevelToggle: (level: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  availableTags: string[];
  activeFilterCount: number;
  onResetFilters: () => void;
  vaultFilter: string;
  onVaultFilterChange: (vault: string) => void;
  mobile?: boolean;
}

const STYLES = ["All Styles", "Bold & Dynamic", "Minimalist", "Emoji-Rich", "Subtitles Only"];
const VIRALITY_LEVELS = [
  { id: "high", label: "High (>80)", color: "bg-green-500/20 text-green-500 border-green-500/30" },
  { id: "medium", label: "Medium (50-80)", color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
  { id: "low", label: "Low (<50)", color: "bg-red-500/20 text-red-500 border-red-500/30" },
];
const VAULT_STATUSES = [
  { id: "pending", label: "Pending" },
  { id: "listed", label: "Listed" },
  { id: "history", label: "History" },
  // "archived" is a lifecycle state rather than a clip status — the API
  // resolves it against `archivedAt` instead of filtering on `status`.
  { id: "archived", label: "Archived" },
];

export default function ProjectFilters({
  captionsStyle,
  onCaptionsStyleChange,
  viralityLevels,
  onViralityLevelToggle,
  selectedTags,
  onTagsChange,
  availableTags,
  activeFilterCount,
  onResetFilters,
  vaultFilter,
  onVaultFilterChange,
  mobile,
}: ProjectFiltersProps) {
  return (
    <div className={`w-full ${!mobile ? "w-64 space-y-8" : "space-y-6"} flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-white" />
          <h2 className="text-lg font-bold text-white">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="bg-brand text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onResetFilters}
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors flex items-center gap-1"
            aria-label="Clear all filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Style Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Style</h3>
        <select
          value={captionsStyle}
          onChange={(e) => onCaptionsStyleChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all cursor-pointer"
        >
          {STYLES.map((style) => (
            <option key={style} value={style} className="bg-background text-white">
              {style}
            </option>
          ))}
        </select>
      </div>

      {/* Virality Score Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Virality Score</h3>
        <div className="flex flex-col gap-2">
          {VIRALITY_LEVELS.map((level) => {
            const isActive = viralityLevels.includes(level.id);
            return (
              <label
                key={level.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isActive ? `bg-white/10 border-white/20` : "bg-transparent border-transparent hover:bg-white/5"
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  isActive ? "bg-brand border-brand" : "bg-black/50 border-white/20"
                }`}>
                  {isActive && <div className="w-2.5 h-2.5 bg-black rounded-sm" />}
                </div>
                <div className={`text-sm font-medium px-2 py-1 rounded-md border ${level.color}`}>
                  {level.label}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Vault Status Filter */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Vault Status</h3>
        <div className="flex flex-wrap gap-2">
          {VAULT_STATUSES.map((status) => {
            const isActive = vaultFilter === status.id;
            return (
              <button
                key={status.id}
                onClick={() => onVaultFilterChange(status.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-brand text-black shadow-[0_0_15px_rgba(var(--brand),0.3)]"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {status.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Tags</h3>
          <TagsFilter
            selectedTags={selectedTags}
            onTagsChange={onTagsChange}
            availableTags={availableTags}
            placeholder="Search tags..."
          />
        </div>
      )}
    </div>
  );
}
