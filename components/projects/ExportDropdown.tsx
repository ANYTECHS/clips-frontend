"use client";

import React, { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2, Check } from "lucide-react";
import analytics from "@/app/lib/analytics";

export interface ExportOptions {
  format: "mp4" | "webm";
  aspectRatio: "9:16" | "1:1" | "16:9";
  quality: "source" | "720p" | "1080p";
  platform: "tiktok" | "instagram" | "youtube" | "x";
}

interface ExportDropdownProps {
  clipId: string;
  userPlan?: "free" | "pro" | "enterprise";
  onExportStarted?: () => void;
}

const FORMATS: ExportOptions["format"][] = ["mp4", "webm"];
const ASPECT_RATIOS: ExportOptions["aspectRatio"][] = ["9:16", "1:1", "16:9"];
const QUALITIES: ExportOptions["quality"][] = ["source", "720p", "1080p"];
const PLATFORM_PRESETS = {
  tiktok: { label: "TikTok", aspectRatio: "9:16" as const, quality: "1080p" as const, codec: "H.264" },
  instagram: { label: "Reels", aspectRatio: "9:16" as const, quality: "1080p" as const, codec: "H.264" },
  youtube: { label: "Shorts", aspectRatio: "9:16" as const, quality: "1080p" as const, codec: "VP9" },
  x: { label: "X", aspectRatio: "16:9" as const, quality: "720p" as const, codec: "H.264" },
};

/**
 * Dropdown menu for exporting video clips with format, aspect ratio, and quality options.
 * Sends export request to the API and shows loading/success states.
 *
 * @param props.clipId - The ID of the clip to export
 * @param props.userPlan - User's plan tier for quality restrictions
 * @param props.onExportStarted - Callback fired when export request is initiated
 */
export default function ExportDropdown({
  clipId,
  userPlan = "free",
  onExportStarted,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    format: "mp4",
    aspectRatio: "9:16",
    quality: "source",
    platform: "tiktok",
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isQualityDisabled = (quality: ExportOptions["quality"]) =>
    userPlan === "free" && quality !== "720p";

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isQualityDisabled(options.quality)) return;

    setExporting(true);
    setSuccess(false);

    try {
      const res = await fetch(`/api/clips/${clipId}/transcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Export failed");
      }

      analytics.trackEvent("clip_export_started", {
        clipId,
        format: options.format,
        aspectRatio: options.aspectRatio,
        quality: options.quality,
      });

      setSuccess(true);
      onExportStarted?.();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  };

  const applyPreset = (platform: ExportOptions["platform"]) => {
    const preset = PLATFORM_PRESETS[platform];
    setOptions((current) => ({ ...current, platform, aspectRatio: preset.aspectRatio, quality: preset.quality }));
  };

  const handleBulkExport = async () => {
    const platforms = (Object.keys(PLATFORM_PRESETS) as ExportOptions["platform"][]).filter(
      (platform) => !isQualityDisabled(PLATFORM_PRESETS[platform].quality),
    );
    setExporting(true);
    try {
      await Promise.all(platforms.map((platform) => {
        const preset = PLATFORM_PRESETS[platform];
        return fetch(`/api/clips/${clipId}/transcode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...options, platform, aspectRatio: preset.aspectRatio, quality: preset.quality }),
        }).then((response) => {
          if (!response.ok) throw new Error("Bulk export failed");
        });
      }));
      setSuccess(true);
      onExportStarted?.();
    } catch {
      setSuccess(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div ref={ref} className="relative flex-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
        aria-label="Export clip"
        aria-expanded={open}
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : success ? (
          <Check className="w-4 h-4 text-brand" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl p-3 shadow-xl z-20 space-y-3 min-w-[200px]">
          <div>
            <label className="text-[10px] uppercase text-white/50 font-bold mb-1 block">Platform preset</label>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(PLATFORM_PRESETS) as ExportOptions["platform"][]).map((platform) => (
                <button key={platform} onClick={() => applyPreset(platform)} className={`py-1 rounded text-xs font-medium ${options.platform === platform ? "bg-brand text-black" : "bg-white/5 text-white/70"}`}>
                  {PLATFORM_PRESETS[platform].label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-white/40">{PLATFORM_PRESETS[options.platform].aspectRatio} · {PLATFORM_PRESETS[options.platform].quality} · {PLATFORM_PRESETS[options.platform].codec}</p>
          </div>

          <div>
            <label className="text-[10px] uppercase text-white/50 font-bold mb-1 block">Format</label>
            <div className="flex gap-1">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setOptions((o) => ({ ...o, format: f }))}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    options.format === f ? "bg-brand text-black" : "bg-white/5 text-white/70"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-white/50 font-bold mb-1 block">Aspect Ratio</label>
            <div className="flex gap-1">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r}
                  onClick={() => setOptions((o) => ({ ...o, aspectRatio: r }))}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    options.aspectRatio === r ? "bg-brand text-black" : "bg-white/5 text-white/70"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-white/50 font-bold mb-1 block">Quality</label>
            <div className="flex gap-1">
              {QUALITIES.map((q) => {
                const disabled = isQualityDisabled(q);
                return (
                  <button
                    key={q}
                    disabled={disabled}
                    onClick={() => setOptions((o) => ({ ...o, quality: q }))}
                    className={`flex-1 py-1 rounded text-xs font-medium ${
                      options.quality === q ? "bg-brand text-black" : "bg-white/5 text-white/70"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    title={disabled ? "Pro plan required" : undefined}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || isQualityDisabled(options.quality)}
            className="w-full py-2 bg-brand text-black rounded-lg text-xs font-bold hover:bg-brand-hover disabled:opacity-50"
          >
            {exporting ? "Starting..." : "Start Export"}
          </button>
          <button onClick={handleBulkExport} disabled={exporting} className="w-full py-2 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 disabled:opacity-50">
            Export compatible platforms
          </button>
        </div>
      )}
    </div>
  );
}
