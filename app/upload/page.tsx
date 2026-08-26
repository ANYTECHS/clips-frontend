"use client";

/**
 * /app/upload/page.tsx
 *
 * Upload page — drag-and-drop or click-to-browse, per-file XHR progress bars,
 * per-file cancel, client-side magic-byte hint, and concurrency-capped uploads.
 *
 * On success the user is redirected to /dashboard/processing?jobId=<id>
 * (the first completed job is used as the primary redirect target).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useUploadProgress,
  type FileProgress,
} from "@/app/hooks/useUploadProgress";
import {
  CloudUpload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  XCircle,
  Film,
} from "lucide-react";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";
import SharedProgressBar from "@/components/ui/ProgressBar";
import { MAX_UPLOAD_SIZE_BYTES, MAX_FILES_PER_REQUEST } from "@/app/lib/constants";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

/**
 * Known video magic-byte signatures — mirrors the server-side check so we can
 * surface an error immediately without a round-trip.
 *
 * We read only the first 12 bytes:
 *  - MP4 / MOV : bytes 4-7 are "ftyp"
 *  - AVI       : bytes 0-3 are "RIFF"
 *  - MKV       : bytes 0-3 are 0x1A 0x45 0xDF 0xA3
 */
async function clientMagicByteHint(file: File): Promise<string | null> {
  try {
    const slice = file.slice(0, 12);
    const buf = new Uint8Array(await slice.arrayBuffer());

    const isFtyp =
      buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70; // "ftyp"
    const isRiff =
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46; // "RIFF"
    const isMkv =
      buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;

    if (!isFtyp && !isRiff && !isMkv) {
      return `"${file.name}" does not appear to be a valid video file.`;
    }
    return null;
  } catch {
    // If we can't read the slice, let the server handle it
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FileStatusIcon({ status }: { status: FileProgress["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircle className="w-4 h-4 text-brand shrink-0" aria-label="Upload complete" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-label="Upload failed" />;
    case "cancelled":
      return <XCircle className="w-4 h-4 text-yellow-400 shrink-0" aria-label="Upload cancelled" />;
    case "uploading":
      return (
        <Loader2
          className="w-4 h-4 text-brand animate-spin shrink-0"
          aria-label="Uploading…"
        />
      );
    default:
      return (
        <div
          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
          aria-label="Queued"
        />
      );
  }
}

function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: FileProgress["status"];
}) {
  const color =
    status === "error"
      ? "bg-red-500"
      : status === "cancelled"
        ? "bg-yellow-500"
        : "bg-brand";

  return <SharedProgressBar value={value} fillClassName={color} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const { progresses, results, isUploading, upload, cancelFile, cancelAll } =
    useUploadProgress();

  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didRedirect = useRef(false);

  // ── Redirect on first successful job ──────────────────────────────────────

  useEffect(() => {
    if (didRedirect.current) return;
    const firstDone = results[0];
    if (firstDone?.jobId) {
      didRedirect.current = true;
      // Small delay so the user sees the "Done!" state briefly
      const t = setTimeout(() => {
        router.push(`/dashboard/processing?jobId=${firstDone.jobId}`);
      }, 1_200);
      return () => clearTimeout(t);
    }
  }, [results, router]);

  // ── File validation ────────────────────────────────────────────────────────

  const validateAndAdd = useCallback(async (incoming: File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];

    // Check batch limit first
    const slotsLeft = MAX_FILES_PER_REQUEST - files.length;
    if (incoming.length > slotsLeft) {
      errors.push(
        `You can upload at most ${MAX_FILES_PER_REQUEST} files at once. ` +
          `${incoming.length - slotsLeft} file(s) skipped.`,
      );
    }

    const candidates = incoming.slice(0, Math.max(0, slotsLeft));

    for (const f of candidates) {
      const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");

      if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(f.type)) {
        errors.push(
          `"${f.name}" has an unsupported format. Allowed: MP4, MOV, AVI, MKV.`,
        );
        continue;
      }

      if (f.size > MAX_UPLOAD_SIZE_BYTES) {
        errors.push(`"${f.name}" exceeds the 500 MB file size limit.`);
        continue;
      }

      // Client-side magic byte hint (non-blocking — file may not be readable yet)
      const magicError = await clientMagicByteHint(f);
      if (magicError) {
        errors.push(magicError);
        continue;
      }

      // Deduplicate by name
      if (!files.some((existing) => existing.name === f.name)) {
        valid.push(f);
      }
    }

    setValidationErrors(errors);
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  }, [files]);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      void validateAndAdd(incoming);
    },
    [validateAndAdd],
  );

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles],
  );

  // ── Remove a queued (not-yet-uploading) file ───────────────────────────────

  const removeFile = useCallback(
    (name: string) => {
      setFiles((prev) => prev.filter((f) => f.name !== name));
      setValidationErrors([]);
    },
    [],
  );

  // ── Upload trigger ─────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || isUploading) return;
    didRedirect.current = false;
    await upload(files);
  }, [files, isUploading, upload]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const allDone =
    files.length > 0 &&
    files.every((f) => {
      const s = progresses[f.name]?.status;
      return s === "done" || s === "error" || s === "cancelled";
    });

  const uploadedCount = files.filter(
    (f) => progresses[f.name]?.status === "done",
  ).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-white font-sans">
      <BackgroundOrbs variant="upload" />

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Upload Video
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop up to {MAX_FILES_PER_REQUEST} MP4, MOV, AVI, or MKV files (max 500 MB each).
            Each file is scanned and processed independently.
          </p>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload video files — click or drag and drop"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          className={[
            "relative cursor-pointer rounded-2xl border-2 border-dashed p-10",
            "flex flex-col items-center justify-center gap-3",
            "transition-all duration-200 focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            dragOver
              ? "border-brand bg-brand/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            isUploading ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center">
            {dragOver ? (
              <Film className="w-7 h-7 text-brand" aria-hidden />
            ) : (
              <CloudUpload className="w-7 h-7 text-brand" aria-hidden />
            )}
          </div>

          <div className="text-center">
            <p className="font-semibold text-white text-sm">
              {dragOver ? "Drop files here" : "Click or drag files here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP4 · MOV · AVI · MKV — max 500 MB each
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp4,.mov,.avi,.mkv,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(Array.from(e.target.files));
              // Reset so the same file can be re-added after removal
              e.target.value = "";
            }}
            disabled={isUploading}
            aria-label="Select video files"
          />
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <ul
            role="alert"
            className="mt-3 space-y-1"
            aria-label="File validation errors"
          >
            {validationErrors.map((err) => (
              <li
                key={err}
                className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-3"
              >
                <AlertCircle
                  className="w-4 h-4 shrink-0 mt-0.5"
                  aria-hidden
                />
                <span>{err}</span>
              </li>
            ))}
          </ul>
        )}

        {/* File list */}
        {files.length > 0 && (
          <ul className="mt-6 space-y-3" aria-label="Upload queue">
            {files.map((file) => {
              const prog = progresses[file.name] ?? {
                percent: 0,
                status: "idle" as const,
              };
              const canCancel =
                prog.status === "uploading" || prog.status === "idle";
              const canRemove =
                !isUploading ||
                prog.status === "done" ||
                prog.status === "error" ||
                prog.status === "cancelled";

              return (
                <li
                  key={file.name}
                  className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <FileStatusIcon status={prog.status} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    </div>

                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {prog.percent}%
                    </span>

                    {canCancel && isUploading && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelFile(file.name);
                        }}
                        className="p-1 rounded-lg text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                        aria-label={`Cancel upload of ${file.name}`}
                      >
                        <XCircle className="w-4 h-4" aria-hidden />
                      </button>
                    )}

                    {canRemove && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.name);
                        }}
                        className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5" aria-hidden />
                      </button>
                    )}
                  </div>

                  <ProgressBar value={prog.percent} status={prog.status} />

                  {prog.status === "error" && prog.error && (
                    <p className="text-xs text-red-400" role="alert">
                      {prog.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Action bar */}
        {files.length > 0 && (
          <div className="mt-6 flex gap-3" role="group" aria-label="Upload actions">
            {/* Primary button */}
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0 || allDone}
              className={[
                "flex-1 flex items-center justify-center gap-2",
                "font-bold py-3 px-6 rounded-xl transition-all active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "bg-brand hover:bg-brand-hover text-black",
                "shadow-[0_8px_24px_rgba(0,230,138,0.25)]",
              ].join(" ")}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Uploading…
                </>
              ) : allDone ? (
                <>
                  <CheckCircle className="w-4 h-4" aria-hidden />
                  Done!
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" aria-hidden />
                  Upload {files.length} file{files.length !== 1 ? "s" : ""}
                </>
              )}
            </button>

            {/* Cancel all — only while uploading */}
            {isUploading && (
              <button
                type="button"
                onClick={cancelAll}
                className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-semibold text-sm"
                aria-label="Cancel all uploads"
              >
                Cancel All
              </button>
            )}

            {/* Clear queue — only when idle */}
            {!isUploading && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setValidationErrors([]);
                }}
                className="px-4 py-3 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 transition-all font-semibold text-sm"
                aria-label="Clear file list"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Success banner */}
        {results.length > 0 && uploadedCount > 0 && (
          <div
            role="status"
            className="mt-6 flex items-center gap-3 bg-brand/10 border border-brand/20 rounded-xl px-4 py-3"
          >
            <CheckCircle className="w-5 h-5 text-brand shrink-0" aria-hidden />
            <p className="text-sm text-white font-medium">
              {uploadedCount} file{uploadedCount !== 1 ? "s" : ""} uploaded
              successfully. Redirecting to processing…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
