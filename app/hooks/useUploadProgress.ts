/**
 * useUploadProgress
 *
 * XHR-based multi-file upload hook with:
 * - Per-file progress bars (0–100 %)
 * - Concurrency cap (default 3 simultaneous uploads)
 * - Per-file cancel via cancelFile(name)
 * - Cancel-all via cancelAll()
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { UPLOAD_CONCURRENCY } from "@/app/lib/constants";
import { shouldChunk, uploadFileInChunks } from "@/app/lib/chunkedUpload";
import { startMeasure } from "@/app/lib/performanceMonitoring";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-file progress state */
export type FileProgress = {
  /** Upload completion percentage 0–100 */
  percent: number;
  /** Lifecycle status of this file's upload */
  status: "idle" | "uploading" | "done" | "error" | "cancelled";
  /** Human-readable error message when status === "error" */
  error?: string;
};

/** Metadata returned on a successful upload */
export type UploadResult = {
  /** Server-assigned job ID for tracking processing status */
  jobId: string;
  /** Original filename */
  name: string;
  /** Remote URL of the stored file */
  url: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUploadProgress(concurrency = UPLOAD_CONCURRENCY) {
  const [progresses, setProgresses] = useState<Record<string, FileProgress>>({});
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Map from file name → active XHR (so individual files can be cancelled)
  const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map());

  // Chunked uploads are fetch-based, so they cancel through an AbortController
  // rather than an XHR handle.
  const abortMap = useRef<Map<string, AbortController>>(new Map());

  // ── Helpers ────────────────────────────────────────────────────────────────

  const setFileProgress = useCallback(
    (name: string, update: Partial<FileProgress>) => {
      setProgresses((prev) => ({
        ...prev,
        [name]: { ...prev[name], ...update },
      }));
    },
    [],
  );

  // ── Single-file upload ─────────────────────────────────────────────────────

  const uploadFile = useCallback(
    (file: File): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrMap.current.set(file.name, xhr);

        const formData = new FormData();
        formData.append("files", file);

        xhr.open("POST", "/api/upload");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setFileProgress(file.name, { percent, status: "uploading" });
          }
        };

        xhr.onload = () => {
          xhrMap.current.delete(file.name);

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              // API wraps in { data: { jobId, files: [...] }, error: null }
              const payload = data.data ?? data;
              const jobId: string =
                payload.jobId ?? payload.files?.[0]?.jobId ?? "";
              const url: string = payload.files?.[0]?.url ?? "";

              setFileProgress(file.name, { percent: 100, status: "done" });
              resolve({ jobId, name: file.name, url });
            } catch {
              const msg = "Invalid server response";
              setFileProgress(file.name, { status: "error", error: msg });
              reject(new Error(msg));
            }
          } else {
            let msg = `Upload failed (HTTP ${xhr.status})`;
            try {
              const body = JSON.parse(xhr.responseText);
              if (body?.error) msg = body.error;
              else if (body?.data?.error) msg = body.data.error;
            } catch { /* ignore parse error */ }
            setFileProgress(file.name, { status: "error", error: msg });
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => {
          xhrMap.current.delete(file.name);
          const msg = "Network error during upload";
          setFileProgress(file.name, { status: "error", error: msg });
          reject(new Error(msg));
        };

        xhr.onabort = () => {
          xhrMap.current.delete(file.name);
          setFileProgress(file.name, { status: "cancelled" });
          reject(new DOMException("Upload cancelled", "AbortError"));
        };

        setFileProgress(file.name, { percent: 0, status: "uploading" });
        xhr.send(formData);
      });
    },
    [setFileProgress],
  );

  // ── Chunked upload for large files ─────────────────────────────────────────

  /**
   * Upload one large file in resumable chunks.
   *
   * Progress, cancellation and the resolved shape match `uploadFile`, so the
   * queue below does not care which path a given file took.
   */
  const uploadFileChunked = useCallback(
    async (file: File): Promise<UploadResult> => {
      const controller = new AbortController();
      abortMap.current.set(file.name, controller);
      setFileProgress(file.name, { percent: 0, status: "uploading" });

      const endMeasure = startMeasure("upload.total", {
        bytes: file.size,
        mode: "chunked",
      });

      try {
        const result = await uploadFileInChunks(file, {
          signal: controller.signal,
          onProgress: (percent) =>
            setFileProgress(file.name, { percent, status: "uploading" }),
        });
        setFileProgress(file.name, { percent: 100, status: "done" });
        endMeasure({ outcome: "success" });
        return result;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setFileProgress(file.name, { status: "cancelled" });
          endMeasure({ outcome: "cancelled" });
          throw err;
        }
        const msg = err instanceof Error ? err.message : "Upload failed";
        setFileProgress(file.name, { status: "error", error: msg });
        endMeasure({ outcome: "error" });
        throw new Error(msg);
      } finally {
        abortMap.current.delete(file.name);
      }
    },
    [setFileProgress],
  );

  // ── Concurrency-limited queue ──────────────────────────────────────────────

  /**
   * Upload `files` with at most `concurrency` simultaneous XHRs.
   * Returns the list of successful UploadResults.
   */
  const upload = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      if (files.length === 0) return [];

      // Reset state
      xhrMap.current = new Map();
      abortMap.current = new Map();
      const initProgress: Record<string, FileProgress> = {};
      files.forEach((f) => {
        initProgress[f.name] = { percent: 0, status: "idle" };
      });
      setProgresses(initProgress);
      setResults([]);
      setIsUploading(true);

      const successful: UploadResult[] = [];

      try {
        // Run the queue with a fixed concurrency slot pool
        let index = 0;

        const worker = async () => {
          while (index < files.length) {
            const current = files[index++];
            // Large files go through the resumable chunked path; small ones
            // keep the cheaper single-request upload.
            const send = shouldChunk(current) ? uploadFileChunked : uploadFile;
            const result = await send(current).catch(() => null);
            if (result) successful.push(result);
          }
        };

        const cap = Math.min(concurrency, files.length);
        await Promise.all(Array.from({ length: cap }, worker));

        setResults(successful);
        return successful;
      } finally {
        setIsUploading(false);
        xhrMap.current.clear();
        abortMap.current.clear();
      }
    },
    [uploadFile, uploadFileChunked, concurrency],
  );

  // ── Cancel helpers ─────────────────────────────────────────────────────────

  /** Abort a single in-flight upload by filename */
  const cancelFile = useCallback((name: string) => {
    const controller = abortMap.current.get(name);
    if (controller) {
      controller.abort();
      abortMap.current.delete(name);
      return;
    }

    const xhr = xhrMap.current.get(name);
    if (xhr) {
      xhr.abort();
      xhrMap.current.delete(name);
    } else {
      // File may be queued but not yet uploading — mark cancelled proactively
      setFileProgress(name, { status: "cancelled" });
    }
  }, [setFileProgress]);

  /** Abort all in-flight uploads, on either transport */
  const cancelAll = useCallback(() => {
    xhrMap.current.forEach((xhr) => xhr.abort());
    xhrMap.current.clear();
    abortMap.current.forEach((controller) => controller.abort());
    abortMap.current.clear();
  }, []);

  return { progresses, results, isUploading, upload, cancelFile, cancelAll };
}
