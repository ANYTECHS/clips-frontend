"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Link as LinkIcon,
  Upload,
  Sparkles,
  Check,
  Info,
  Loader2,
  AlertCircle,
  Play,
} from "lucide-react";
import apiClient from "@/lib/apiClient";
import { saveActiveJob } from "@/lib/processingStore";
import { markFreeJobAsClaimed } from "@/lib/freeJobStore";
import { useYouTubeImport, isYouTubeUrl } from "@/lib/useYouTubeImport";
import { uploadVideoToStorage, MAX_VIDEO_FILE_SIZE_BYTES } from "@/lib/uploadToStorage";
import { getFriendlyErrorMessage } from "@/lib/formatError";

export default function CreateClipsForm() {
  const router       = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePlatform, setActivePlatform] = useState("TikTok");
  const [autoGenerate,   setAutoGenerate]   = useState(true);
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [urlValue,       setUrlValue]       = useState("");
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  type UploadState = "idle" | "ready" | "uploading" | "processing";
  const [uploadState, setUploadState] = useState<UploadState>("idle");

  const { state: ytState, run: runYouTube, reset: resetYouTube } = useYouTubeImport();
  const ytBusy = ["fetching-info", "downloading", "uploading"].includes(ytState.phase);
  const anyBusy = loading || ytBusy;

  const platforms = [
    { name: "TikTok",    icon: "📱" },
    { name: "Instagram", icon: "📸" },
    { name: "YT Shorts", icon: "📺" },
  ];

  const platformToApiValue = (name: string): string => {
    if (name === "YT Shorts") return "youtube";
    return name.toLowerCase();
  };

  const isSupportedUrl = (val: string): boolean => {
    try {
      const { hostname } = new URL(val);
      const host = hostname.replace("www.", "");
      if (host === "youtube.com" || host === "youtu.be") return true;
      if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
      if (host === "vimeo.com") return true;
      return false;
    } catch { return false; }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|avi|webm|mkv)$/i.test(file.name)) {
        setError("Please select a valid video file (MP4, MOV, AVI, WEBM, or MKV).");
        return;
      }
      if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
        setError("File size exceeds 1GB limit. Please upload a smaller video.");
        return;
      }
      setSelectedFile(file);
      setUploadState("ready");
      setError("");
    }
  };

  const handleFetchUrl = async () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    if (!isSupportedUrl(trimmed)) {
      setError("Only YouTube, TikTok, and Vimeo URLs are supported.");
      return;
    }
    setError("");
    resetYouTube();

    if (isYouTubeUrl(trimmed)) {
      const result = await runYouTube(trimmed, platformToApiValue(activePlatform));
      if (result.videoId) {
        saveActiveJob(String(result.videoId));
        markFreeJobAsClaimed();
        router.push(`/dashboard/processing?videoId=${result.videoId}`);
      }
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post("/videos/from-url", {
        url:             trimmed,
        targetPlatforms: [platformToApiValue(activePlatform)],
        style:           "viral",
      });
      const data    = response.data;
      const videoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
      if (!videoId) throw new Error("Failed to get video ID from response.");
      saveActiveJob(String(videoId));
      markFreeJobAsClaimed();
      router.push(`/dashboard/processing?videoId=${videoId}`);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, "Failed to submit video URL. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAndGenerate = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setUploadState("uploading");
    setError("");
    setUploadProgress(0);
    try {
      const storageResult = await uploadVideoToStorage(selectedFile, (pct) => {
        setUploadProgress(pct >= 0 ? pct : 0);
      });

      const response = await apiClient.post("/videos/register", {
        cloudinaryUrl: storageResult.url,
        sourceUrl:     storageResult.url,
        publicId:      storageResult.publicId,
        title:         selectedFile.name.replace(/\.[^/.]+$/, ""),
        sourceType:    "upload",
        style:         "viral",
        duration:      storageResult.duration,
        bytes:         storageResult.bytes,
      });

      const data    = response.data;
      const videoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
      if (!videoId) throw new Error("Failed to get video ID from response.");

      setUploadState("processing");
      setUploadProgress(100);
      saveActiveJob(String(videoId));
      markFreeJobAsClaimed();
      router.push(`/dashboard/processing?videoId=${videoId}`);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, "Video upload failed. Please try again."));
      setUploadState(selectedFile ? "ready" : "idle");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const showYtPanel = ytState.phase !== "idle" && ytState.phase !== "done";

  const uploadButtonLabel = () => {
    if (uploadState === "uploading")
      return <><Loader2 className="w-5 h-5 animate-spin" />{uploadProgress > 0 ? `Uploading ${uploadProgress}%` : "Uploading…"}</>;
    if (uploadState === "processing")
      return <><Loader2 className="w-5 h-5 animate-spin" />Generating Clips…</>;
    if (uploadState === "ready")
      return <><Sparkles className="w-5 h-5 fill-black" />Generate Clips</>;
    return <><Upload className="w-5 h-5" />Upload Video</>;
  };

  return (
    <div className="w-full bg-[#06351C]/90 backdrop-blur-3xl border border-[#0e4d2a] rounded-[32px] p-6 sm:p-10 shadow-[0_0_100px_rgba(57,255,20,0.06),inset_0_0_20px_rgba(57,255,20,0.03)] relative overflow-hidden group">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#39FF14]/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-[#39FF14]/10 transition-all duration-700" />

      <div className="space-y-8">
        <div className="space-y-4">
          <label className="text-[13px] font-bold text-[#90A89C] uppercase tracking-wider block ml-1">
            Import from URL
          </label>

          <div className="relative flex items-center group/input">
            <div className="absolute left-6 text-[#90A89C] group-focus-within/input:text-[#B6FF4A] transition-colors">
              <LinkIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={urlValue}
              onChange={(e) => { setUrlValue(e.target.value); setError(""); resetYouTube(); }}
              onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
              disabled={anyBusy}
              placeholder="Paste YouTube, TikTok or Vimeo link here…"
              className="w-full h-14 bg-[#042413] border border-[#0e4d2a] focus:border-[#39FF14]/50 focus:ring-4 focus:ring-[#39FF14]/10 rounded-2xl pl-16 pr-44 text-[14px] font-medium placeholder-[#90A89C] text-[#F4F7EF] transition-all outline-none disabled:opacity-50"
            />
            <button
              onClick={handleFetchUrl}
              disabled={anyBusy || !urlValue.trim()}
              className="absolute right-2 px-6 py-3 bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] font-black rounded-xl text-[14px] transition-all active:scale-[0.98] shadow-[0_4px_20px_rgba(57,255,20,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {anyBusy
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : "Fetch Video"}
            </button>
          </div>
          {showYtPanel && (
            <div className={`rounded-2xl border px-5 py-4 space-y-3 transition-all ${
              ytState.phase === "error"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-[#042413] border-[#B6FF4A]/30"
            }`}>
              {ytState.phase === "error" ? (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-400 font-medium leading-relaxed">
                    {ytState.error}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-[#B6FF4A]" />
                      <span className="text-[13px] font-bold text-[#F4F7EF] truncate max-w-[220px]">
                        {ytState.videoTitle ?? "YouTube Import"}
                      </span>
                    </div>
                    <span className="text-[13px] font-black text-[#B6FF4A] shrink-0 ml-3">
                      {ytState.progress >= 0 ? `${ytState.progress}%` : "…"}
                    </span>
                  </div>

                  <div className="h-2 bg-[#020D08] rounded-full overflow-hidden border border-[#0e4d2a]">
                    <div
                      className="h-full bg-[#39FF14] rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(57,255,20,0.6)]"
                      style={{
                        width:   ytState.progress >= 0 ? `${ytState.progress}%` : "100%",
                        opacity: ytState.progress <  0 ? 0.35 : 1,
                      }}
                    />
                  </div>

                  <p className="text-[11px] font-medium text-[#90A89C]">{ytState.label}</p>

                  {ytState.warning && (
                    <p className="text-[11px] text-yellow-400 font-medium">
                      ⚠ {ytState.warning}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="relative flex items-center justify-center py-2">
          <div className="absolute left-0 right-0 h-px bg-[#0e4d2a]" />
          <span className="relative z-10 px-6 bg-[#06351C] text-[12px] font-black text-[#90A89C] uppercase tracking-[0.2em]">
            OR
          </span>
        </div>
        <div
          className={`group/upload relative ${anyBusy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
          onClick={() => { if (!anyBusy) fileInputRef.current?.click(); }}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="video/*" />
          <div className="w-full aspect-[21/9] sm:aspect-[4.5/1] border-2 border-dashed border-[#0e4d2a] group-hover/upload:border-[#39FF14]/50 rounded-[24px] bg-[#042413]/60 group-hover/upload:bg-[#042413] flex flex-col items-center justify-center gap-4 transition-all duration-500 overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-[#031d0f] border border-[#0e4d2a] flex items-center justify-center group-hover/upload:scale-110 group-hover/upload:border-[#39FF14]/40 transition-all duration-500 relative">
              <div className="absolute inset-0 bg-[#39FF14]/5 blur-xl group-hover/upload:bg-[#39FF14]/15 transition-colors rounded-full" />
              {selectedFile
                ? <Check  className="w-6 h-6 text-[#B6FF4A] relative z-10" />
                : <Upload className="w-6 h-6 text-[#90A89C] group-hover/upload:text-[#B6FF4A] relative z-10" />}
            </div>
            <div className="text-center space-y-1 relative z-10">
              <p className="text-[16px] font-bold text-[#F4F7EF] group-hover/upload:text-[#B6FF4A] transition-colors">
                {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-[12px] font-medium text-[#90A89C]">
                {selectedFile
                  ? `${selectedFile.size >= 1000 * 1024 * 1024 ? (selectedFile.size / (1024 * 1024 * 1024)).toFixed(2) + " GB" : (selectedFile.size / (1024 * 1024)).toFixed(2) + " MB"} — ready to upload`
                  : "MP4, MOV, WEBM up to 1GB"}
              </p>
            </div>
          </div>
        </div>
        {error && (
          <div className="text-red-400 text-sm text-center bg-red-400/10 py-3 rounded-xl border border-red-400/20">
            {error}
          </div>
        )}
        {loading && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="space-y-2">
            <div className="flex justify-between text-[12px] font-bold text-[#90A89C]">
              <span>Uploading to server…</span>
              <span className="text-[#B6FF4A]">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-[#020D08] rounded-full overflow-hidden border border-[#0e4d2a]">
              <div
                className="h-full bg-[#39FF14] rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(57,255,20,0.6)]"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-[#90A89C] text-center">
              Large files may take a moment — do not close this tab
            </p>
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          <div className="space-y-4 flex-1">
            <label className="text-[13px] font-bold text-[#90A89C] uppercase tracking-wider block ml-1">
              Target Platforms
            </label>
            <div className="flex flex-wrap gap-3">
              {platforms.map((platform) => (
                <button
                  key={platform.name}
                  onClick={() => setActivePlatform(platform.name)}
                  className={`px-5 py-2.5 rounded-full border text-[13px] font-bold flex items-center gap-2 transition-all duration-300 ${
                    activePlatform === platform.name
                      ? "bg-[#B6FF4A] text-[#020D08] font-black border-[#B6FF4A] shadow-[0_0_15px_rgba(57,255,20,0.25)]"
                      : "bg-[#042413] border-[#0e4d2a] text-[#90A89C] hover:text-[#F4F7EF] hover:border-[#39FF14]/40"
                  }`}
                >
                  <span className={activePlatform === platform.name ? "opacity-100" : "opacity-60"}>
                    {platform.icon}
                  </span>
                  {platform.name}
                  {activePlatform === platform.name && <Check className="w-3.5 h-3.5 ml-1 text-[#020D08]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#042413] border border-[#0e4d2a] rounded-[24px] p-6 lg:min-w-[320px] flex items-center justify-between group/toggle hover:border-[#39FF14]/40 transition-all">
            <div className="space-y-1">
              <p className="text-[14px] font-bold text-[#F4F7EF] group-hover/toggle:text-[#B6FF4A] transition-colors">
                Auto-generate clips
              </p>
              <p className="text-[11px] font-medium text-[#90A89C]">Extract 50–200 viral moments</p>
            </div>
            <button
              onClick={() => setAutoGenerate(!autoGenerate)}
              className={`w-12 h-6 rounded-full relative transition-all duration-300 ${autoGenerate ? "bg-[#B6FF4A]" : "bg-[#031d0f] border border-[#0e4d2a]"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-[#020D08] transition-all duration-300 ${autoGenerate ? "left-7" : "left-1"}`} />
            </button>
          </div>
        </div>
        <div className="pt-6 border-t border-[#0e4d2a] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-[#90A89C]">
            <Info className="w-4 h-4 text-[#B6FF4A]" />
            <span className="text-[13px] font-medium tracking-tight">
              Estimated processing time: <span className="text-[#F4F7EF] font-bold">4–6 minutes</span>
            </span>
          </div>

          <button
            onClick={handleUploadAndGenerate}
            disabled={anyBusy || !selectedFile}
            className={`w-full sm:w-auto px-10 py-4 rounded-2xl text-[16px] font-black flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
              uploadState === "ready"
                ? "bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] shadow-[0_0_30px_rgba(57,255,20,0.3)] hover:shadow-[0_0_40px_rgba(57,255,20,0.5)]"
                : uploadState === "idle"
                ? "bg-[#042413] border border-[#0e4d2a] text-[#90A89C] opacity-50 cursor-not-allowed"
                : "bg-[#B6FF4A] text-[#020D08] opacity-80"
            }`}
          >
            {uploadButtonLabel()}
          </button>
        </div>

      </div>
    </div>
  );
}
