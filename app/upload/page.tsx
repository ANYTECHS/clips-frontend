"use client";

/**
 * /app/upload/page.tsx — Issue #529
 *
 * Upload page with per-file progress bars, XHR-based upload,
 * and cancellation support via the useUploadProgress hook.
 */

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadProgress, type FileProgress } from "@/app/hooks/useUploadProgress";
import { CloudUpload, X, CheckCircle, AlertCircle, Loader2, XCircle } from "lucide-react";
import BackgroundOrbs from "@/components/layout/BackgroundOrbs";

const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];
const MAX_FILE_SIZE_MB = 500;

function FileStatusIcon({ status }: { status: FileProgress["status"] }) {
  switch (status) {
    case "done":
      return <CheckCircle className="w-4 h-4 text-[#00E68A] shrink-0" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
    case "cancelled":
      return <XCircle className="w-4 h-4 text-yellow-400 shrink-0" />;
    case "uploading":
      return <Loader2 className="w-4 h-4 text-[#00E68A] animate-spin shrink-0" />;
    default:
      return <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />;
  }
}

function ProgressBar({ value, status }: { value: number; status: FileProgress["status"] }) {
  const colorClass =
    status === "error"
      ? "from-red-500 to-red-600"
      : status === "cancelled"
      ? "from-yellow-500 to-yellow-600"
      : "from-[#00E68A] to-[#00c97a]";

  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${colorClass} transition-all duration-300`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router = useRouter();
  const { progresses, results, isUploading, upload, cancelAll } = useUploadProgress();
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = useCallback((incoming: File[]): { valid: File[]; errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    incoming.forEach((f) => {
      const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`"${f.name}" has an unsupported format (allowed: MP4, MOV, AVI, MKV).`);
      } else if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`"${f.name}" exceeds 500 MB limit.`);
      } else {
        valid.push(f);
      }
    });
    return { valid, errors };
  }, []);

  const handleFiles = useCallback(
    (incoming: File[]) => {
      setValidationError(null);
      const { valid, errors } = validateFiles(incoming);
      if (errors.length > 0) setValidationError(errors.join(" "));
      if (valid.length > 0) setFiles((prev) => [...prev, ...valid]);
    },
    [validateFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles]
  );

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const uploadResults = await upload(files);
    // Redirect to first job if successful
    const firstResult = uploadResults?.[0];
    if (firstResult?.jobId) {
      setTimeout(() => router.push(`/jobs/${firstResult.jobId}`), 1200);
    }
  };

  const allDone = files.length > 0 && files.every((f) => progresses[f.name]?.status === "done");

  return (
    <div className="min-h-screen bg-[#060A07] text-white font-sans">
      <BackgroundOrbs variant="upload" />

      <main className="relative z-10 max-w-2xl mx-auto px-4 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Upload Clips</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Upload MP4, MOV, AVI or MKV files (up to 500 MB each). Each file will be
            individually scanned and processed.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
            dragOver
              ? "border-[#00E68A] bg-[#00E68A]/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
          } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#00E68A]/10 flex items-center justify-center">
            <CloudUpload className="w-7 h-7 text-[#00E68A]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-white text-sm">
              {dragOver ? "Drop files here" : "Click or drag files here"}
            </p>
            <p className="text-xs text-zinc-500 mt-1">MP4, MOV, AVI, MKV — max 500 MB each</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp4,.mov,.avi,.mkv,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); }}
            disabled={isUploading}
          />
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="mt-3 flex items-start gap-2 text-sm text-red-400 bg-red-400/10 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            {files.map((file) => {
              const prog = progresses[file.name] ?? { percent: 0, status: "idle" as const };
              return (
                <div
                  key={file.name}
                  className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <FileStatusIcon status={prog.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{file.name}</p>
                      <p className="text-xs text-zinc-500">{formatBytes(file.size)}</p>
                    </div>
                    <span className="text-xs text-zinc-400 shrink-0">{prog.percent}%</span>
                    {!isUploading && prog.status !== "uploading" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3.5 h-3.5 text-zinc-500 hover:text-white" />
                      </button>
                    )}
                  </div>
                  <ProgressBar value={prog.percent} status={prog.status} />
                  {prog.status === "error" && (
                    <p className="text-xs text-red-400">{prog.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        {files.length > 0 && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleUpload}
              disabled={isUploading || files.length === 0 || allDone}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00E68A] hover:bg-[#00c97a] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-xl transition-all active:scale-[0.98] shadow-[0_8px_24px_rgba(0,230,138,0.25)]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : allDone ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Done!
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  Upload {files.length} file{files.length !== 1 ? "s" : ""}
                </>
              )}
            </button>

            {isUploading && (
              <button
                onClick={cancelAll}
                className="px-4 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all font-semibold text-sm"
              >
                Cancel All
              </button>
            )}

            {!isUploading && (
              <button
                onClick={() => { setFiles([]); setValidationError(null); }}
                className="px-4 py-3 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5 transition-all font-semibold text-sm"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Success banner */}
        {results.length > 0 && allDone && (
          <div className="mt-6 flex items-center gap-3 bg-[#00E68A]/10 border border-[#00E68A]/20 rounded-xl px-4 py-3">
            <CheckCircle className="w-5 h-5 text-[#00E68A] shrink-0" />
            <p className="text-sm text-white font-medium">
              {results.length} file{results.length !== 1 ? "s" : ""} uploaded successfully. Redirecting to your job…
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
