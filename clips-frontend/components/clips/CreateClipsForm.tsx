"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Link as LinkIcon, 
  Upload, 
  Sparkles, 
  Check, 
  Info 
} from "lucide-react";
import Switch from "../Switch";

export default function CreateClipsForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePlatforms, setActivePlatforms] = useState<string[]>(["TikTok"]);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const platforms = [
    { name: "TikTok", icon: "📱" },
    { name: "Instagram", icon: "📸" },
    { name: "YT Shorts", icon: "📺" },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = () => {
    // Navigate to the processing page with selected platforms
    router.push(`/dashboard/processing?platforms=${encodeURIComponent(activePlatforms.join(","))}`);
  };

  const [videoUrl, setVideoUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const ytVimeoRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtu(?:be\.com\/(?:watch\?v=|embed\/|v\/)|\.be\/)|vimeo\.com\/)([\w-]{11,}|\d+)(?:[&?#].*)?$/i;

  const validateUrl = (value: string) => {
    if (!value) return false;
    return ytVimeoRegex.test(value.trim());
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setVideoUrl(val);
    if (val === "") {
      setUrlError(null);
      return;
    }
    setUrlError(validateUrl(val) ? null : "Please enter a valid YouTube or Vimeo URL");
  };

  const handleClipNow = () => {
    if (!validateUrl(videoUrl)) {
      setUrlError("Please enter a valid YouTube or Vimeo URL");
      return;
    }
    router.push(`/dashboard/processing?source=${encodeURIComponent(videoUrl)}`);
  };

  return (
    <div className="w-full bg-background/80 backdrop-blur-3xl border border-brand/20 rounded-[32px] p-6 sm:p-10 shadow-[0_0_100px_rgba(0,229,143,0.03),inset_0_0_20px_rgba(0,229,143,0.05)] relative overflow-hidden group">
      {/* Glow Effect Corner */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-brand/10 transition-all duration-700" />
      
      <div className="space-y-8">
        {/* Import from URL Section */}
        <div className="space-y-3">
          <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
            Paste YouTube or Vimeo URL
          </label>
          <div className="relative flex items-center group/input">
            <div className="absolute left-6 text-subtle group-focus-within/input:text-brand transition-colors">
              <LinkIcon className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={videoUrl}
              onChange={handleUrlChange}
              placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..." 
              className={`w-full h-14 bg-input border rounded-2xl pl-16 pr-36 text-[14px] font-medium placeholder-subtle text-white transition-all outline-none ${
                urlError ? "border-rose-500 ring-0" : "border-white/[0.03] focus:border-brand/60"
              } focus:ring-4 ${urlError ? "focus:ring-rose-500/20" : "focus:ring-brand/15"}`}
            />
            <button 
              onClick={handleClipNow}
              className="absolute right-2 px-5 py-3 bg-brand hover:bg-brand-hover text-black font-bold rounded-xl text-[14px] transition-all active:scale-[0.98] shadow-[0_6px_30px_rgba(0,229,143,0.25)]"
            >
              Clip Now
            </button>
          </div>
          {urlError && (
            <p className="text-[12px] text-rose-500 ml-1">{urlError}</p>
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center py-2">
          <div className="absolute left-0 right-0 h-px bg-white/[0.03]" />
          <span className="relative z-10 px-6 bg-background text-[12px] font-black text-subtle uppercase tracking-[0.2em]">OR</span>
        </div>

        {/* Upload Area */}
        <div className="group/upload relative" onClick={handleUploadClick}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="video/*"
          />
          <div className="w-full aspect-[21/9] sm:aspect-[4.5/1] border-2 border-dashed border-white/5 group-hover/upload:border-brand/20 rounded-[24px] bg-white/[0.01] group-hover/upload:bg-brand/[0.01] flex flex-col items-center justify-center gap-4 transition-all duration-500 cursor-pointer overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-input border border-white/5 flex items-center justify-center group-hover/upload:scale-110 group-hover/upload:border-brand/20 transition-all duration-500 relative">
              <div className="absolute inset-0 bg-brand/5 blur-xl group-hover/upload:bg-brand/10 transition-colors rounded-full" />
              {selectedFile ? (
                <Check className="w-6 h-6 text-brand relative z-10" />
              ) : (
                <Upload className="w-6 h-6 text-muted-foreground group-hover/upload:text-brand relative z-10" />
              )}
            </div>
            <div className="text-center space-y-1 relative z-10">
              <p className="text-[16px] font-bold text-white group-hover/upload:text-brand transition-colors">
                {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-[12px] font-medium text-subtle">
                {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : "MP4, MOV, WEBM up to 2GB"}
              </p>
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          {/* Target Platforms */}
          <div className="space-y-4 flex-1">
            <label className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider block ml-1">
              Target Platforms
            </label>
            <div className="flex flex-wrap gap-3">
              {platforms.map((platform) => {
                const isActive = activePlatforms.includes(platform.name);
                return (
                  <button 
                    key={platform.name}
                    onClick={() =>
                      setActivePlatforms((prev) =>
                        prev.includes(platform.name)
                          ? prev.length > 1 ? prev.filter((p) => p !== platform.name) : prev
                          : [...prev, platform.name]
                      )
                    }
                    aria-pressed={isActive}
                    className={`px-5 py-2.5 rounded-full border text-[13px] font-bold flex items-center gap-2 transition-all duration-300 ${
                      isActive
                        ? "bg-brand/10 border-brand text-brand shadow-[0_0_15px_rgba(0,229,143,0.15)]" 
                        : "bg-input border-white/5 text-muted-foreground hover:text-white hover:border-white/10"
                    }`}
                  >
                    <span className={isActive ? "opacity-100" : "opacity-40 grayscale group-hover:grayscale-0 transition-all"}>
                      {platform.icon}
                    </span>
                    {platform.name}
                    {isActive && <Check className="w-3.5 h-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto Generate Toggle */}
          <div className="bg-input/50 border border-white/5 rounded-[24px] p-6 lg:min-w-[320px] flex items-center justify-between group/toggle hover:border-brand/20 transition-all">
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-white group-hover/toggle:text-brand transition-colors">Auto-generate clips</p>
              <p className="text-[11px] font-medium text-muted-foreground">Extract 50–200 viral moments</p>
            </div>
            <Switch checked={autoGenerate} onChange={(v) => setAutoGenerate(v)} ariaLabel="Auto-generate clips" />
          </div>
        </div>

        {/* Footer Action Row */}
        <div className="pt-6 border-t border-white/[0.03] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Info className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px] font-medium tracking-tight">Estimated processing time: <span className="text-white">4–6 minutes</span></span>
          </div>
          <button 
            onClick={handleGenerate}
            disabled={activePlatforms.length === 0}
            className="w-full sm:w-auto px-10 py-4.5 bg-brand hover:shadow-[0_0_40px_rgba(0,229,143,0.4)] text-black font-black rounded-2xl text-[16px] flex items-center justify-center gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            <span>Generate Clips</span>
            <Sparkles className="w-5 h-5 fill-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
