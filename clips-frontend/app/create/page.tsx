"use client";

import { useState, useCallback } from "react";
import { Sparkles, Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useProcessStore } from "../hooks/useProcessStore";

type Platform = "tiktok" | "instagram" | "youtube";

interface PlatformState {
  id: Platform;
  name: string;
  enabled: boolean;
}

const INITIAL_PLATFORMS: PlatformState[] = [
  { id: "tiktok", name: "TikTok", enabled: false },
  { id: "instagram", name: "Instagram", enabled: false },
  { id: "youtube", name: "YouTube", enabled: false },
];

export default function CreateClipsPage() {
  const router = useRouter();
  const { startProcess } = useProcessStore();
  
  // Form state
  const [videoUrl, setVideoUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [platforms, setPlatforms] = useState<PlatformState[]>(INITIAL_PLATFORMS);
  const [autoPublish, setAutoPublish] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const hasVideoInput = videoUrl.trim() !== "" || uploadedFile !== null;
  const hasSelectedPlatform = platforms.some((p) => p.enabled);
  const isFormValid = hasVideoInput && hasSelectedPlatform && !isSubmitting;

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Clear URL if file is selected
      setVideoUrl("");
      setUploadedFile(file);
      setError(null);
    }
  }, []);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    // Clear file if URL is entered
    if (url.trim() !== "") {
      setUploadedFile(null);
    }
    setError(null);
  }, []);

  const togglePlatform = useCallback((platformId: Platform) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.id === platformId ? { ...p, enabled: !p.enabled } : p))
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Add video source
      if (uploadedFile) {
        formData.append("video", uploadedFile);
      } else if (videoUrl) {
        formData.append("videoUrl", videoUrl);
      }

      // Add selected platforms
      const selectedPlatforms = platforms.filter((p) => p.enabled).map((p) => p.id);
      formData.append("platforms", JSON.stringify(selectedPlatforms));
      
      // Add auto-publish toggle
      formData.append("autoPublish", String(autoPublish));

      // Submit to backend
      const response = await fetch("/api/clips/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to generate clips" }));
        throw new Error(errorData.message || "Failed to generate clips");
      }

      const data = await response.json();
      
      // Start process tracking
      const jobLabel = uploadedFile?.name || videoUrl || "Clip Generation";
      startProcess(data.jobId || crypto.randomUUID(), jobLabel);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-white">Create Clips</h1>
          <p className="mt-2 text-zinc-400">
            Upload a video or paste a URL to generate AI-powered clips
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video Input Section */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Video Source</h2>
            
            {/* URL Input */}
            <div className="mb-4">
              <label htmlFor="video-url" className="mb-2 block text-sm text-zinc-400">
                Video URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <input
                  id="video-url"
                  type="url"
                  value={videoUrl}
                  onChange={handleUrlChange}
                  placeholder="https://youtube.com/watch?v=..."
                  disabled={uploadedFile !== null || isSubmitting}
                  className="w-full rounded-xl bg-zinc-900/50 py-3 pl-11 pr-4 text-white placeholder-zinc-500 outline-none ring-1 ring-zinc-800 transition focus:ring-2 focus:ring-[#00E68A] disabled:opacity-50"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-zinc-950 px-4 text-zinc-500">OR</span>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label htmlFor="video-file" className="mb-2 block text-sm text-zinc-400">
                Upload Video File
              </label>
              <label
                htmlFor="video-file"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-8 transition hover:border-zinc-700 hover:bg-zinc-900/50 ${
                  videoUrl.trim() !== "" || isSubmitting ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <Upload className="mb-3 h-10 w-10 text-zinc-600" />
                <p className="mb-1 text-sm font-medium text-white">
                  {uploadedFile ? uploadedFile.name : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-zinc-500">MP4, MOV, AVI (max 500MB)</p>
                <input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  disabled={videoUrl.trim() !== "" || isSubmitting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Platform Selection */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Target Platforms</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => togglePlatform(platform.id)}
                  disabled={isSubmitting}
                  className={`rounded-xl p-4 text-center font-medium transition ${
                    platform.enabled
                      ? "bg-[#00E68A]/10 text-[#00E68A] ring-2 ring-[#00E68A]"
                      : "bg-zinc-900/50 text-zinc-400 ring-1 ring-zinc-800 hover:bg-zinc-900"
                  } disabled:opacity-50`}
                >
                  {platform.name}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Publish Toggle */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <label className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Auto-Publish</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Automatically publish clips to selected platforms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoPublish(!autoPublish)}
                disabled={isSubmitting}
                className={`relative h-7 w-12 rounded-full transition ${
                  autoPublish ? "bg-[#00E68A]" : "bg-zinc-700"
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                    autoPublish ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isFormValid}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E68A] px-6 py-4 text-base font-semibold text-black shadow-[0_8px_24px_rgba(0,230,138,0.35)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Generating Clips...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                Generate Clips
              </>
            )}
          </button>

          {/* Validation Hint */}
          {!hasVideoInput && (
            <p className="text-center text-sm text-zinc-500">
              Please provide a video URL or upload a file
            </p>
          )}
          {hasVideoInput && !hasSelectedPlatform && (
            <p className="text-center text-sm text-zinc-500">
              Please select at least one platform
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
