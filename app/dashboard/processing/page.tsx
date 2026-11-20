"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import ProcessingHeader from "@/components/dashboard/ProcessingHeader";
import DashboardLayout from "@/components/shared/DashboardLayout";
import { getProjectsData } from "@/lib/queries";
import apiClient from "@/lib/apiClient";
import { loadActiveJob, saveActiveJob, clearActiveJob } from "@/lib/processingStore";
import { markFreeJobAsClaimed } from "@/lib/freeJobStore";
import { Sparkles, Clock, RefreshCw, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import Button from "@/components/shared/Button";

// ─── Strategy ─────────────────────────────────────────────────────────────────
// 1. Primary:  SSE via /api/sse/events/processing-progress/:videoId
//    - Dedicated streaming proxy that pipes bytes without buffering
//    - Gives real-time progress from the backend AI engine
// 2. Fallback: Poll GET /videos/:id every 4 s
//    - Kicks in automatically if SSE fails / drops after 10 s of silence
//    - Checks clipsCount / status field on the video object
// Both paths prefetch clips into React Query cache and navigate instantly.
//
// Persistence (refresh / leave-and-come-back):
//  - videoId is stored in localStorage (via processingStore) by CreateClipsForm /
//    URLForm before navigating here.
//  - On mount, if the URL has no videoId we fall back to the stored job so a
//    refresh or direct visit to /dashboard/processing re-attaches automatically.
//  - startedAt is also persisted so elapsed-time estimates stay correct after reload.
//  - The store entry is cleared only on success or on an unrecoverable error,
//    so closing the tab mid-job and reopening it still reconnects.

const SSE_SILENCE_TIMEOUT = 45_000;  // 45 s watchdog before starting backup polling (gives AI backend time to start)
const POLL_INTERVAL       = 4_000;   // poll every 4 s
const MAX_WAIT_MS         = 15 * 60 * 1000; // 15 min hard cap

function ProcessingContent() {
  const [progress,   setProgress]   = useState(0);
  const [statusMsg,  setStatusMsg]  = useState(() => {
    // If we're resuming a stored job show a reconnecting message instantly
    const job = loadActiveJob();
    const elapsed = job ? Math.round((Date.now() - job.startedAt) / 1000) : 0;
    return elapsed > 5 ? "Reconnecting to AI engine…" : "Connecting to AI engine…";
  });
  const [clipsFound, setClipsFound] = useState<number | null>(null);
  const [isDone,     setIsDone]     = useState(false);
  const [hasError,   setHasError]   = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [mode,       setMode]       = useState<"sse" | "polling">("sse");

  const searchParams = useSearchParams();
  const router       = useRouter();
  const queryClient  = useQueryClient();

  // ── Resolve videoId ────────────────────────────────────────────────────────
  // Priority: URL param → localStorage store (refresh / leave-and-return)
  // If neither exists we redirect to dashboard.
  const paramId = searchParams.get("videoId");
  const storedJob = loadActiveJob();
  const videoId   = (paramId && paramId !== "undefined") ? paramId : storedJob?.videoId ?? null;

  // If we recovered the videoId from the store but the URL doesn't have it,
  // rewrite the URL so the user can share/bookmark it and so refreshes work.
  useEffect(() => {
    if (!paramId || paramId === "undefined") {
      if (videoId) {
        router.replace(`/dashboard/processing?videoId=${videoId}`);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigated      = useRef(false);
  // Restore startedAt from the store so elapsed-time estimates survive a refresh
  const startedAt      = useRef(storedJob?.startedAt ?? Date.now());
  // Track the highest progress value seen from SSE so polling never goes backwards
  const lastSseProgress = useRef(0);
  const esRef          = useRef<EventSource | null>(null);
  const pollRef        = useRef<NodeJS.Timeout | null>(null);
  const silenceRef     = useRef<NodeJS.Timeout | null>(null);
  const usingPoll      = useRef(false);

  useEffect(() => {
    if (!videoId || videoId === "undefined") {
      setStatusMsg("No active job found — redirecting…");
      setTimeout(() => router.push("/dashboard"), 3000);
      return;
    }

    // Ensure the store is up-to-date (covers the refresh case where the URL
    // param is present but the store was cleared, e.g. user copied the URL)
    saveActiveJob(videoId);

    // ── Shared finish handler ──────────────────────────────────────────────
    const finish = async (vid: string) => {
      if (navigated.current) return;
      navigated.current = true;

      esRef.current?.close();
      if (pollRef.current)   clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);

      // Job done — remove the persisted entry so a fresh visit starts clean
      clearActiveJob();
      markFreeJobAsClaimed();

      setIsDone(true);
      setProgress(100);
      setStatusMsg("All clips generated! Preparing your clips…");

      // Small delay in fetching clips when AI finishes:
      // Poll quickly (every 600ms, up to 6s) until clips are returned,
      // so when the user lands on the project page, all clips are ready!
      let clips: any[] = [];
      const startTime = Date.now();
      while (Date.now() - startTime < 6000) {
        try {
          clips = await getProjectsData(vid);
          if (Array.isArray(clips) && clips.length > 0) {
            break;
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 600));
      }

      if (clips.length > 0) {
        queryClient.setQueryData(["projectsData", vid, 1], clips);
      }
      queryClient.invalidateQueries({ queryKey: ["sidebarClipCount"] });

      router.push(`/projects?videoId=${vid}`);
    };

    const failWith = (msg: string) => {
      esRef.current?.close();
      if (pollRef.current)    clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);
      // Clear the store on unrecoverable failure so the user can start fresh
      clearActiveJob();
      setHasError(true);
      setErrorMsg(msg);
    };

    // ── Polling fallback ───────────────────────────────────────────────────
    const startPolling = () => {
      if (usingPoll.current) return;
      usingPoll.current = true;
      setMode("polling");

      const DONE_STATUSES = ["done", "completed", "complete", "finished", "success", "succeeded", "ready"];

      const poll = async () => {
        if (navigated.current) return;
        if (Date.now() - startedAt.current > MAX_WAIT_MS) {
          failWith("Processing is taking longer than expected. Check your Projects page in a few minutes.");
          return;
        }
        try {
          const res   = await apiClient.get(`/videos/${videoId}`);
          const raw   = res.data;
          const video = raw?.data ?? raw?.video ?? raw ?? {};
          const status: string = (video.status ?? raw?.status ?? "processing").toString().toLowerCase().trim();

          console.log("[poll] video status:", status, video);

          if (status === "failed" || status === "error") {
            failWith(video.errorMessage || raw?.errorMessage || "Generation failed. Please try again.");
            return;
          }

          // Check if the backend explicitly reports progress
          const rawBackendProgress = typeof video.progress === "number"
            ? video.progress
            : typeof raw?.progress === "number"
            ? raw.progress
            : null;

          if (rawBackendProgress !== null) {
            const currentP = Math.max(rawBackendProgress, lastSseProgress.current);
            setProgress(currentP);
            lastSseProgress.current = currentP;
            if (currentP >= 100) {
              await finish(videoId);
              return;
            }
          } else {
            // Animate progress based on elapsed time — but never go below what
            // SSE already reported.
            const elapsed = (Date.now() - startedAt.current) / 1000;
            if (status === "analyzing") {
              setStatusMsg("Analyzing video retention patterns…");
              const estimate = Math.min(25, Math.round(elapsed * 0.6));
              if (estimate > lastSseProgress.current) setProgress(estimate);
            } else if (status === "processing") {
              setStatusMsg("AI is generating viral clips…");
              const estimate = Math.min(95, 25 + Math.round(elapsed * 0.4));
              if (estimate > lastSseProgress.current) setProgress(estimate);
            }
          }

          let clips = video.clips ?? raw?.clips ?? [];
          let count = typeof video.clipsCount === "number"
            ? video.clipsCount
            : typeof raw?.clipsCount === "number"
            ? raw.clipsCount
            : typeof video.totalClips === "number"
            ? video.totalClips
            : (Array.isArray(clips) ? clips.length : 0);

          // If no clips found directly on the video object and status isn't explicitly completed,
          // probe /videos/:id/clips in case clips are stored on the dedicated endpoint
          if (count === 0 && !DONE_STATUSES.includes(status)) {
            try {
              const clipsRes = await apiClient.get(`/videos/${videoId}/clips?page=1&limit=1`);
              const clipsData = clipsRes.data?.data ?? (Array.isArray(clipsRes.data) ? clipsRes.data : []);
              const totalCount = clipsRes.data?.total ?? clipsData.length;
              if (totalCount > 0) {
                count = totalCount;
                clips = clipsData;
              }
            } catch { /* non-fatal check */ }
          }

          if (count > 0) setClipsFound(count);

          const isDoneStatus  = DONE_STATUSES.includes(status);
          const hasClips      = count > 0;

          if (isDoneStatus || hasClips) {
            await finish(videoId);
          }
        } catch (e: any) {
          console.warn("[poll] transient error, retrying:", e?.message);
        }
      };

      poll(); // immediate first check
      pollRef.current = setInterval(poll, POLL_INTERVAL);
    };

    // ── SSE primary ────────────────────────────────────────────────────────
    const connectSSE = () => {
      // Dedicated SSE proxy — streams bytes without buffering
      const url = `/api/sse/events/processing-progress/${videoId}`;
      console.log("[sse] connecting →", url);

      const es = new EventSource(url);
      esRef.current = es;

      // Silence watchdog — if no event arrives in SSE_SILENCE_TIMEOUT, start fallback polling
      const resetSilence = () => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = setTimeout(() => {
          console.warn("[sse] silence timeout — starting polling as backup");
          // Don't close ES if it's still alive; start polling as backup
          startPolling();
        }, SSE_SILENCE_TIMEOUT);
      };
      resetSilence();

      es.onopen = () => {
        console.log("[sse] connected");
        setStatusMsg("AI engine connected — analyzing your video…");
        resetSilence();
      };

      const handleEventData = (rawData: any) => {
        resetSilence(); // got heartbeat or data — reset watchdog
        try {
          const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
          console.log("[sse] event:", data);

          if (typeof data.progress === "number") {
            setProgress(data.progress);
            if (data.progress > lastSseProgress.current) {
              lastSseProgress.current = data.progress;
            }
          }
          if (typeof data.clipsFound === "number") {
            setClipsFound(data.clipsFound);
          } else if (Array.isArray(data.clips) && data.clips.length > 0) {
            setClipsFound(data.clips.length);
          }

          const status: string = (data.status ?? "").toString().toLowerCase().trim();

          if (status === "failed" || status === "error") {
            failWith(
              data.message && !data.message.toLowerCase().includes("status code")
                ? data.message
                : "Generation failed. Please try again."
            );
            return;
          }

          if (data.message) setStatusMsg(data.message);

          // Accept any completion-like status string, progress=100, or clips attached
          const DONE_STATUSES = ["done", "completed", "complete", "finished", "success", "succeeded", "ready"];
          const hasCompletionClips =
            (typeof data.clipsFound === "number" && data.clipsFound > 0) ||
            (Array.isArray(data.clips) && data.clips.length > 0);

          if (DONE_STATUSES.includes(status) || data.progress >= 100 || hasCompletionClips) {
            finish(videoId);
          }
        } catch (e) {
          console.warn("[sse] parse error:", e);
        }
      };

      es.onmessage = (event) => handleEventData(event.data);

      // Listen to named SSE events
      const EVENT_NAMES = ["progress", "status", "clip", "clips", "done", "complete", "completed", "message"];
      EVENT_NAMES.forEach((evtName) => {
        es.addEventListener(evtName, (event: any) => handleEventData(event.data));
      });

      es.onerror = () => {
        console.warn("[sse] stream closed/error — switching to polling");
        es.close();
        esRef.current = null;
        if (silenceRef.current) clearTimeout(silenceRef.current);
        if (!navigated.current) startPolling();
      };
    };

    connectSSE();

    return () => {
      esRef.current?.close();
      if (pollRef.current)    clearInterval(pollRef.current);
      if (silenceRef.current) clearTimeout(silenceRef.current);
    };
  }, [videoId, router, queryClient]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
      {/* Icon */}
      <div className="flex flex-col items-center text-center space-y-6 mb-12">
        <div className="relative">
          <div className={`absolute inset-0 blur-2xl rounded-full animate-pulse ${isDone ? "bg-[#B6FF4A]/30" : "bg-[#39FF14]/20"}`} />
          <div className="relative w-24 h-24 rounded-full bg-[#042413] border border-[#39FF14]/30 flex items-center justify-center shadow-[inset_0_0_20px_rgba(57,255,20,0.15)]">
            {isDone ? (
              <CheckCircle2 className="w-10 h-10 text-[#B6FF4A]" />
            ) : hasError ? (
              <AlertCircle className="w-10 h-10 text-red-400" />
            ) : (
              <Sparkles className="w-10 h-10 text-[#39FF14] drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]" />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#F4F7EF]">
            {isDone
              ? "Clips are ready!"
              : hasError
              ? "Generation failed"
              : "AI is finding viral moments…"}
          </h1>
          <p className={`text-lg md:text-xl max-w-2xl mx-auto font-medium ${hasError ? "text-red-400" : "text-[#90A89C]"}`}>
            {hasError ? errorMsg : statusMsg}
          </p>
          {mode === "polling" && !isDone && !hasError && (
            <p className="text-[11px] text-[#90A89C] font-medium">
              Checking for updates every {POLL_INTERVAL / 1000}s…
            </p>
          )}
        </div>
      </div>

      {/* Progress card */}
      <div className="w-full max-w-4xl bg-[#06351C] border border-[#0e4d2a] rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 border border-[#39FF14]/10 rounded-[32px] pointer-events-none group-hover:border-[#39FF14]/25 transition-colors" />

        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#042413] border border-[#0e4d2a] flex items-center justify-center">
                <RefreshCw className={`w-3.5 h-3.5 text-[#39FF14] ${!isDone && !hasError ? "animate-spin" : ""}`} />
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#90A89C]">
                {mode === "sse" ? "Live Stream" : "Polling"}
              </span>
            </div>
            <span className="text-3xl font-black text-[#39FF14]">{progress}%</span>
          </div>

          <div className="relative h-4 w-full bg-[#042413] rounded-full overflow-hidden border border-[#0e4d2a]">
            <div
              className="absolute top-0 left-0 h-full bg-[#39FF14] rounded-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(57,255,20,0.5)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-[#90A89C] text-sm font-medium">
              <Clock className="w-4 h-4 text-[#B6FF4A]" />
              <span>
                {isDone
                  ? "Processing complete"
                  : progress > 0
                  ? `~${Math.max(1, Math.round((100 - progress) * 0.5))}s remaining`
                  : "Estimating time…"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className={`w-2 h-2 rounded-full ${hasError ? "bg-red-400" : "bg-[#39FF14] animate-pulse"} shadow-[0_0_8px_#39FF14]`} />
              <span className="text-[#F4F7EF]">{hasError ? "Error" : "GPU Accelerated"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mt-6">
        <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#39FF14]/30 transition-all">
          <span className="text-[11px] font-bold text-[#90A89C] uppercase tracking-widest">Moments Found</span>
          <span className="text-3xl font-extrabold text-[#F4F7EF]">
            {clipsFound !== null ? clipsFound : "…"}
          </span>
        </div>
        <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#39FF14]/30 transition-all">
          <span className="text-[11px] font-bold text-[#90A89C] uppercase tracking-widest">Input Quality</span>
          <span className="text-3xl font-extrabold text-[#F4F7EF]">HD</span>
          <span className="text-[#90A89C] text-xs font-bold">Auto-detected</span>
        </div>
        <div className="bg-[#06351C] border border-[#0e4d2a] rounded-2xl p-6 flex flex-col items-center text-center space-y-2 group hover:border-[#39FF14]/30 transition-all">
          <span className="text-[11px] font-bold text-[#90A89C] uppercase tracking-widest">AI Throughput</span>
          <span className="text-3xl font-extrabold text-[#F4F7EF]">2.5x</span>
          <span className="text-[#B6FF4A] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1">
            <Zap className="w-3 h-3 fill-current" /> Turbo
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-12 flex flex-col items-center space-y-4">
        {isDone ? (
          <Button size="lg" onClick={() => router.push(`/projects?videoId=${videoId}`)}
          >
            <CheckCircle2 className="w-4 h-4" />
            View My Clips
          </Button>
        ) : hasError ? (
          <>
            <Button size="lg" onClick={() => router.push("/clips")}
            >
              Try Again
            </Button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full border border-[#0e4d2a] bg-[#042413] hover:bg-[#084223] hover:border-[#39FF14]/40 text-[#F4F7EF] font-bold text-sm transition-all active:scale-[0.98]"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-full border border-[#0e4d2a] bg-[#042413] hover:bg-[#084223] hover:border-[#39FF14]/40 text-[#F4F7EF] font-bold text-sm transition-all active:scale-[0.98]"
            >
              Go to Dashboard
            </button>
            <p className="text-[#90A89C] text-xs text-center max-w-sm leading-relaxed">
              Processing continues in the background — you can safely leave this page and come back anytime.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <DashboardLayout showHeader={false}>
      <ProcessingHeader />
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center text-white">
            <RefreshCw className="w-6 h-6 animate-spin text-[#B6FF4A]" />
          </div>
        }
      >
        <ProcessingContent />
      </Suspense>

      <footer className="w-full flex flex-col md:flex-row items-center justify-between px-10 py-8 border-t border-[#0e4d2a] mt-auto bg-transparent relative z-10 gap-4">
        <p className="text-[#90A89C] text-xs font-medium">© {new Date().getFullYear()} enclips. All rights reserved.</p>
        <div className="flex items-center gap-8">
          <Link href="/privacy" className="text-[#90A89C] hover:text-[#F4F7EF] text-xs font-medium transition-colors">Privacy Policy</Link>
          <Link href="/terms"   className="text-[#90A89C] hover:text-[#F4F7EF] text-xs font-medium transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </DashboardLayout>
  );
}
