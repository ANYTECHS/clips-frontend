/**
 * useUploadProgress — Issue #529
 *
 * Custom hook that uploads files via XMLHttpRequest so that
 * onprogress events are available for per-file progress bars.
 * Returns progress state, upload function, and a cancel function.
 */

import { useState, useCallback, useRef } from "react";

/** Tracking container object representing progress metrics for individual files */
export type FileProgress = {
  /** 0–100 completion percentage indicator */
  percent: number;
  /** State machine status string tracking execution phases */
  status: "idle" | "uploading" | "done" | "error" | "cancelled";
  /** Optional failure details populating on errors */
  error?: string;
};

/** Metadata payload mapping information returned on successful ingest */
export type UploadResult = {
  /** The server-side async tracking ID associated with processing the artifact */
  jobId: string;
  /** The baseline name string matching the origin payload */
  name: string;
  /** The remote asset destination access endpoint URL */
  url: string;
};

/**
 * Custom hook handling safe parallel multi-file file streaming contexts using underlying XHR event channels.
 *
 * @returns State properties, status maps, and asynchronous invocation tools for batch execution and manual abort overrides.
 */
export function useUploadProgress() {
  const [progresses, setProgresses] = useState<Record<string, FileProgress>>({});
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Keep a ref to all active XHRs so we can abort them
  const xhrRefs = useRef<XMLHttpRequest[]>([]);

  /**
   * Dispatches micro-mutations matching granular progress shifts per file index.
   */
  const setFileProgress = useCallback(
    (fileName: string, update: Partial<FileProgress>) => {
      setProgresses((prev) => ({
        ...prev,
        [fileName]: { ...prev[fileName], ...update },
      }));
    },
    []
  );

  /**
   * Handles low-level XHR transport initialization, header bundling, and streaming callbacks for an explicit payload.
   * * @param file - The distinct binary file target instance requested for transmission.
   * @returns Resolves to a structural report object containing tracking metadata upon ingest completion.
   */
  const uploadFile = useCallback(
    (file: File): Promise<UploadResult> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRefs.current.push(xhr);

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
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setFileProgress(file.name, { percent: 100, status: "done" });
              resolve({
                jobId: data.jobId ?? data.files?.[0]?.jobId ?? "",
                name: file.name,
                url: data.files?.[0]?.url ?? "",
              });
            } catch {
              setFileProgress(file.name, { status: "error", error: "Invalid server response" });
              reject(new Error("Invalid server response"));
            }
          } else {
            const msg = `Upload failed (HTTP ${xhr.status})`;
            setFileProgress(file.name, { status: "error", error: msg });
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => {
          const msg = "Network error during upload";
          setFileProgress(file.name, { status: "error", error: msg });
          reject(new Error(msg));
        };

        xhr.onabort = () => {
          setFileProgress(file.name, { status: "cancelled" });
          reject(new DOMException("Upload cancelled", "AbortError"));
        };

        xhr.send(formData);
      });
    },
    [setFileProgress]
  );

  /**
   * Orchestrates parallel batch processing pipelines across variable file array configurations.
   * * @param files - List of File targets slated for transit dispatching.
   * @returns Structured collection summarizing successfully loaded files and their active job associations.
   */
  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Reset state
      xhrRefs.current = [];
      const initProgress: Record<string, FileProgress> = {};
      files.forEach((f) => (initProgress[f.name] = { percent: 0, status: "idle" }));
      setProgresses(initProgress);
      setResults([]);
      setIsUploading(true);

      try {
        const uploadResults = await Promise.allSettled(files.map(uploadFile));
        const successful: UploadResult[] = [];
        uploadResults.forEach((r) => {
          if (r.status === "fulfilled") successful.push(r.value);
        });
        setResults(successful);
        return successful;
      } finally {
        setIsUploading(false);
        xhrRefs.current = [];
      }
    },
    [uploadFile]
  );

  /**
   * Iterates through active XHR connections to force instant abort events.
   */
  const cancelAll = useCallback(() => {
    xhrRefs.current.forEach((xhr) => xhr.abort());
    xhrRefs.current = [];
  }, []);

  return { progresses, results, isUploading, upload, cancelAll };
}
