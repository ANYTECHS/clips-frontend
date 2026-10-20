"use client";

import React, { useState, useEffect } from "react";
import { LayoutTemplate, Search, Sparkles, Check, ArrowRight } from "lucide-react";
import { sanitize } from "@/app/lib/sanitize";

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  isPreset: boolean;
  aspectRatio: "9:16" | "1:1" | "16:9";
  durationSeconds: number;
  style: string;
  transformStyle?: string | null;
}

interface TemplateGalleryProps {
  onApplyTemplate?: (template: TemplateItem) => void;
  selectedTemplateId?: string | null;
  className?: string;
}

const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: "preset-tiktok-viral",
    name: "TikTok Viral Hooks",
    description: "Fast-paced cuts with dynamic bold captions and 9:16 vertical framing.",
    isPreset: true,
    aspectRatio: "9:16",
    durationSeconds: 15,
    style: "Bold & Dynamic",
    transformStyle: "anime",
  },
  {
    id: "preset-yt-shorts",
    name: "YouTube Shorts Explainer",
    description: "Clean minimalist subtitles with smooth transition pacing for education.",
    isPreset: true,
    aspectRatio: "9:16",
    durationSeconds: 45,
    style: "Minimalist",
    transformStyle: null,
  },
  {
    id: "preset-ig-reels",
    name: "Instagram Aesthetic",
    description: "Vibrant emoji-rich styling optimized for reels feed discovery.",
    isPreset: true,
    aspectRatio: "9:16",
    durationSeconds: 30,
    style: "Emoji-Rich",
    transformStyle: "cyberpunk",
  },
  {
    id: "preset-square-feed",
    name: "Square Feed Highlights",
    description: "1:1 square ratio for cross-platform carousel and timeline posts.",
    isPreset: true,
    aspectRatio: "1:1",
    durationSeconds: 60,
    style: "Subtitles Only",
    transformStyle: null,
  },
];

export default function TemplateGallery({
  onApplyTemplate,
  selectedTemplateId = null,
  className = "",
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>(DEFAULT_TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(selectedTemplateId);
  const [search, setSearch] = useState("");
  const [filterRatio, setFilterRatio] = useState<string>("all");

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.templates && Array.isArray(json.data.templates)) {
          const mapped: TemplateItem[] = json.data.templates.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            isPreset: Boolean(t.isPreset),
            aspectRatio: t.settings?.aspectRatio || "9:16",
            durationSeconds: t.settings?.durationSeconds || 30,
            style: t.settings?.style || "Bold & Dynamic",
            transformStyle: t.settings?.transformStyle || null,
          }));
          if (mapped.length > 0) {
            setTemplates(mapped);
          }
        }
      })
      .catch(() => {});
  }, []);

  const filtered = templates.filter((tpl) => {
    if (search) {
      const q = search.toLowerCase();
      if (!tpl.name.toLowerCase().includes(q) && !tpl.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterRatio !== "all" && tpl.aspectRatio !== filterRatio) {
      return false;
    }
    return true;
  });

  const handleApply = (tpl: TemplateItem) => {
    setActiveTemplateId(tpl.id);
    onApplyTemplate?.(tpl);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutTemplate className="w-5 h-5 text-brand" />
            <h2 className="text-xl font-extrabold text-white">Template Gallery</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Browse and apply pre-configured aspect ratios, captions, and AI styles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full bg-input rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:border-brand"
            />
          </div>

          {/* Ratio filter */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/5">
            {["all", "9:16", "1:1", "16:9"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFilterRatio(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase transition-all ${
                  filterRatio === r ? "bg-white/20 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((tpl) => {
          const isSelected = activeTemplateId === tpl.id;
          return (
            <div
              key={tpl.id}
              className={`flex flex-col justify-between p-4 rounded-2xl border transition-all ${
                isSelected
                  ? "bg-brand/10 border-brand/50 shadow-[0_0_20px_rgba(0,229,143,0.15)]"
                  : "bg-surface border-white/5 hover:border-white/20"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-white truncate">{sanitize(tpl.name)}</h3>
                  <span className="shrink-0 text-[10px] font-mono font-bold bg-white/10 px-2 py-0.5 rounded text-white/70">
                    {tpl.aspectRatio}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                  {sanitize(tpl.description)}
                </p>

                <div className="space-y-1.5 text-[11px] text-white/60 bg-white/5 p-2.5 rounded-xl border border-white/5 mb-4">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-semibold text-white">{tpl.durationSeconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Caption Style:</span>
                    <span className="font-semibold text-white">{tpl.style}</span>
                  </div>
                  {tpl.transformStyle && (
                    <div className="flex justify-between">
                      <span>AI Style:</span>
                      <span className="font-semibold text-brand flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {tpl.transformStyle}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApply(tpl)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-brand text-black"
                    : "bg-white/10 hover:bg-brand hover:text-black text-white"
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Applied
                  </>
                ) : (
                  <>
                    Apply Template
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
