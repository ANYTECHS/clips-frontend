"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import { useTransformStore, selectJobById, selectTransformHasHydrated } from "@/app/store/transformStore";
import { useTransformStatus } from "@/app/hooks/useTransformStatus";
import {
  DEFAULT_BLUR_PLACEHOLDER,
  SIZES_TRANSFORM_THUMB,
  SIZES_TRANSFORM_PREVIEW,
} from "@/app/lib/imageUtils";

// eslint-disable-next-line @typescript-eslint/naming-convention
const ComparisonPlayer = dynamic(() => import("@/components/transform/ComparisonPlayer"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      <div className="aspect-video bg-white/5 rounded-2xl" />
      <div className="aspect-video bg-white/5 rounded-2xl" />
    </div>
  ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEta(seconds: number | null | undefined): string {
  if (seconds == null) return "Calculating…";
  if (seconds <= 0) return "Almost done…";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s remaining` : `${s}s remaining`;
}

function styleLabel(style: string): string {
  return style.charAt(0).toUpperCase() + style.slice(1);
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TransformProgressPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = typeof params.id === "string" ? params.id : null;

  const hasHydrated = useTransformStore(selectTransformHasHydrated);
  const job = useTransformStore(jobId ? selectJobById(jobId) : () => undefined);

  // Poll for live progress until terminal status
  const isTerminal = job?.status === "complete" || job?.status === "error";
  useTransformStatus(jobId, hasHydrated && !isTerminal);

  // Derived values
  const progress = job?.progress ?? 0;
  const status = job?.status ?? "queued";
  const style = job?.style ?? "";
  const previewUrl = job?.previewUrl ?? null;
  const resultUrl = job?.resultUrl ?? null;
  const errorMessage = job?.errorMessage;

  // ETA tracking — smoothed; store doesn't carry this directly so we track via progress deltas
  const [eta, setEta] = useState<number | null>(null);
  const lastProgressRef = useRef<{ progress: number; time: number } | null>(null);

  useEffect(() => {
    if (status !== "processing") return;
    const now = Date.now();
    const prev = lastProgressRef.current;
    if (prev && progress > prev.progress) {
      const elapsed = (now - prev.time) / 1000;
      const rate = (progress - prev.progress) / elapsed; // % per second
      const remaining = (100 - progress) / rate;
      setEta(Math.round(remaining));
    }
    lastProgressRef.current = { progress, time: now };
  }, [progress, status]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  // ── Job not found ──────────────────────────────────────────────────────────
  if (!job) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 px-6">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h1 className="text-2xl font-extrabold">Transform job not found</h1>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          This job ID doesn&apos;t exist or has expired. Return to your projects to start a new transformation.
        </p>
        <button
          onClick={() => router.push("/projects")}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand text-black font-bold text-sm hover:bg-brand-hover transition-all"
        >
          <ChevronRight className="w-4 h-4" />
          Go to Projects
        </button>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === "error") {
    const isUnsupportedFormat = errorMessage?.toLowerCase().includes("format");
    const isQuotaExceeded = errorMessage?.toLowerCase().includes("quota");
    const isTimeout = errorMessage?.toLowerCase().includes("timeout");

    return (
      <div className="min-h-screen bg-background text-white flex flex-col font-sans relative overflow-hidden">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-red-500/5 blur-[120px] rounded-full" />
        </div>

        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
          <div className="relative mb-10">
            <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-full bg-surface border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-9 h-9 text-red-500" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-3">
            Transformation Failed
          </h1>

          {isUnsupportedFormat && (
            <p className="text-muted-foreground text-center text-sm max-w-md mb-8">
              This clip format isn&apos;t supported for AI transformation. Try converting to MP4 (H.264) first.
            </p>
          )}
          {isQuotaExceeded && (
            <p className="text-muted-foreground text-center text-sm max-w-md mb-8">
              You&apos;ve reached your transformation quota for this billing period. Upgrade your plan to continue.
            </p>
          )}
          {isTimeout && (
            <p className="text-muted-foreground text-center text-sm max-w-md mb-8">
              The AI backend timed out. This usually happens with very long clips. Try trimming the clip to under 60 seconds.
            </p>
          )}
          {!isUnsupportedFormat && !isQuotaExceeded && !isTimeout && (
            <p className="text-muted-foreground text-center text-sm max-w-md mb-8">
              {errorMessage ?? "An unexpected error occurred. Our team has been notified."}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push(`/projects`)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand text-black font-bold text-sm hover:bg-brand-hover transition-all"
            >
              <Wand2 className="w-4 h-4" />
              Try Another Style
            </button>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-gray-300 font-bold text-sm transition-all"
            >
              <X className="w-4 h-4" />
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Complete state ─────────────────────────────────────────────────────────
  if (status === "complete" && resultUrl) {
    // Use sourceClipId as a placeholder original — in production this would
    // be resolved to a pre-signed URL from cloud storage.
    const originalSrc = `/api/clips/${job.sourceClipId}/stream`;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col font-sans relative overflow-hidden">
        <BackgroundOrbs variant="default" />

        <main className="flex-1 flex flex-col items-center px-6 py-16 relative z-10">
          <div className="w-full max-w-4xl space-y-10">
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full" />
                <div className="relative w-16 h-16 rounded-full bg-surface border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold">
                Transformation Complete
              </h1>
              <p className="text-muted-foreground text-sm">
                Your clip has been transformed to{" "}
                <span className="text-brand font-bold">{styleLabel(style)}</span> style.
              </p>
            </div>

            {/* Side-by-side comparison */}
            <div className="bg-surface border border-white/5 rounded-3xl p-6 md:p-8">
              <ComparisonPlayer originalSrc={originalSrc} transformedSrc={resultUrl} />
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => router.push("/vault")}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl bg-brand text-black font-bold text-xs hover:bg-brand-hover transition-all"
              >
                <Upload className="w-4 h-4" />
                Save to Vault
              </button>
              <button
                onClick={() => router.push("/platforms")}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-white font-bold text-xs transition-all"
              >
                <Sparkles className="w-4 h-4 text-brand" />
                Post to Platforms
              </button>
              <button
                onClick={() => router.push("/projects")}
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-white font-bold text-xs transition-all"
              >
                <Wand2 className="w-4 h-4 text-brand" />
                Try Another Style
              </button>
              <a
                href={resultUrl}
                download
                className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-white font-bold text-xs transition-all text-center"
              >
                <Download className="w-4 h-4 text-brand" />
                Download
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Processing / Queued state (default) ────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-white flex flex-col font-sans relative overflow-hidden">
      <BackgroundOrbs variant="default" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-3xl space-y-10">
          {/* Hero */}
          <div className="flex flex-col items-center text-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-brand/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-surface border border-brand/30 flex items-center justify-center">
                <Wand2 className="w-9 h-9 text-brand" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2">
                AI Transformation in Progress
              </h1>
              <p className="text-muted-foreground text-sm">
                Applying{" "}
                <span className="text-brand font-bold">{styleLabel(style)}</span> style to your clip…
              </p>
            </div>
          </div>

          {/* Main card */}
          <div className="bg-surface border border-white/5 rounded-3xl p-8 space-y-7">
            {/* Clip thumbnail placeholder */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-14 rounded-xl bg-input border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Latest preview frame"
                    fill
                    sizes={SIZES_TRANSFORM_THUMB}
                    placeholder="blur"
                    blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                    className="object-cover rounded-xl"
                  />
                ) : (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Clip {job.sourceClipId}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Style: <span className="text-brand font-semibold">{styleLabel(style)}</span>
                </p>
              </div>
              <div className="ml-auto shrink-0">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand bg-brand/10 border border-brand/20 px-2.5 py-1 rounded-full">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {status === "queued" ? "Queued" : "Processing"}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-brand">{progress}%</span>
              </div>
              <div className="relative h-3 w-full bg-input rounded-full overflow-hidden border border-white/5">
                <div
                  className="absolute top-0 left-0 h-full bg-brand rounded-full transition-all duration-[1500ms] ease-out shadow-[0_0_12px_rgba(0,255,133,0.4)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* ETA */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              <span>ETA: {formatEta(eta)}</span>
            </div>

            {/* Preview frames */}
            {previewUrl && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Latest Preview Frame
                </p>
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
                  <Image
                    src={previewUrl}
                    alt="Preview frame from AI transformation"
                    fill
                    sizes={SIZES_TRANSFORM_PREVIEW}
                    placeholder="blur"
                    blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                    className="object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cancel */}
          <div className="flex justify-center">
            <button
              onClick={() => router.push("/projects")}
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 bg-surface hover:bg-input hover:border-white/20 text-gray-300 font-bold text-sm transition-all"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>

          <p className="text-center text-muted-foreground text-xs leading-relaxed">
            Closing this window won&apos;t cancel the transformation.{" "}
            <Link href="/projects" className="text-brand hover:underline">
              View all projects
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
