"use client";

import React, { useState } from "react";
import { Loader2, Link2, AlertCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { saveActiveJob } from "@/lib/processingStore";
import { markFreeJobAsClaimed } from "@/lib/freeJobStore";
import { useYouTubeImport, isYouTubeUrl } from "@/lib/useYouTubeImport";
import { getFriendlyErrorMessage } from "@/lib/formatError";

export default function URLForm() {
  const router = useRouter();
  const [url,   setUrl]   = useState("");
  const [error, setError] = useState("");

  const { state: ytState, run: runYouTube, reset: resetYouTube } = useYouTubeImport();
  const ytBusy  = ["fetching-info", "downloading", "uploading"].includes(ytState.phase);
  const anyBusy = ytBusy;

  const isSupported = (val: string): boolean => {
    try {
      const { hostname } = new URL(val);
      const host = hostname.replace("www.", "");
      if (host === "youtube.com" || host === "youtu.be") return true;
      if (host === "tiktok.com" || host === "vm.tiktok.com" || host === "vt.tiktok.com") return true;
      if (host === "vimeo.com") return true;
      return false;
    } catch { return false; }
  };

  const handleURLSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (anyBusy) return;

    const trimmed = url.trim();
    if (!trimmed) return;

    if (!isSupported(trimmed)) {
      setError("Only YouTube, TikTok, and Vimeo URLs are supported.");
      return;
    }

    setError("");
    resetYouTube();
    if (isYouTubeUrl(trimmed)) {
      const result = await runYouTube(trimmed, "tiktok");
      if (result.videoId) {
        saveActiveJob(String(result.videoId));
        markFreeJobAsClaimed();
        router.push(`/dashboard/processing?videoId=${result.videoId}`);
      }
      return;
    }
    try {
      const response = await apiClient.post("/videos/from-url", {
        url:             trimmed,
        targetPlatforms: ["tiktok", "instagram"],
        style:           "viral",
      });
      const data    = response.data;
      const videoId = data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
      if (!videoId) throw new Error("Failed to get video ID from response.");
      saveActiveJob(String(videoId));
      markFreeJobAsClaimed();
      router.push(`/dashboard/processing?videoId=${videoId}`);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, "Failed to process video link. Please try again."));
    }
  };

  // Show the YouTube panel whenever the hook has left idle/done
  const showYtPanel = ytState.phase !== "idle" && ytState.phase !== "done";

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleURLSubmit} className="flex gap-4 w-full">
        <div className="relative flex-1 max-w-[340px] group">
          <label htmlFor="video-url" className="sr-only">Video URL</label>
          <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#90A89C] group-focus-within:text-[#B6FF4A] transition-colors" />
          <input
            id="video-url"
            type="url"
            placeholder="Paste YouTube, TikTok or Vimeo URL"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); resetYouTube(); }}
            disabled={anyBusy}
            className={`w-full bg-[#042413] border ${
              error ? "border-red-500/50" : "border-[#0e4d2a]"
            } rounded-[14px] py-3.5 pl-12 pr-4 text-[#F4F7EF] placeholder-[#90A89C] focus:outline-none focus:border-[#39FF14]/50 focus:bg-[#042413] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        </div>

        <button
          type="submit"
          disabled={anyBusy || !url.trim()}
          className="bg-[#B6FF4A] hover:bg-[#c6ff6b] text-[#020D08] px-8 py-3.5 rounded-[14px] font-black text-sm tracking-wide transition-all disabled:opacity-70 flex items-center justify-center gap-2 min-w-[130px] shadow-[0_0_20px_rgba(57,255,20,0.25)]"
        >
          {anyBusy
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing</>
            : "Clip Now"}
        </button>
      </form>
      {error && (
        <p className="text-red-500 text-xs ml-1">{error}</p>
      )}
      {showYtPanel && (
        <div className={`rounded-2xl border px-4 py-3 space-y-2 transition-all ${
          ytState.phase === "error"
            ? "bg-red-500/10 border-red-500/30"
            : "bg-[#06351C] border-[#0e4d2a]"
        }`}>
          {ytState.phase === "error" ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 font-medium leading-relaxed">
                {ytState.error}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Play className="w-3.5 h-3.5 text-[#B6FF4A] shrink-0" />
                  <span className="text-xs font-bold text-[#F4F7EF] truncate">
                    {ytState.videoTitle ?? "YouTube Import"}
                  </span>
                </div>
                <span className="text-xs font-black text-[#B6FF4A] shrink-0">
                  {ytState.progress >= 0 ? `${ytState.progress}%` : "…"}
                </span>
              </div>

              <div className="h-1.5 bg-[#031d0f] rounded-full overflow-hidden border border-[#0e4d2a]">
                <div
                  className="h-full bg-[#39FF14] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(57,255,20,0.4)]"
                  style={{
                    width:   ytState.progress >= 0 ? `${ytState.progress}%` : "100%",
                    opacity: ytState.progress <  0 ? 0.35 : 1,
                  }}
                />
              </div>

              <p className="text-[10px] font-medium text-[#90A89C]">{ytState.label}</p>

              {ytState.warning && (
                <p className="text-[10px] text-yellow-400 font-medium">⚠ {ytState.warning}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
