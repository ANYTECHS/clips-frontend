"use client";

import { useState, useCallback } from "react";
import { saveActiveJob } from "@/lib/processingStore";
import { markFreeJobAsClaimed } from "@/lib/freeJobStore";
import apiClient from "@/lib/apiClient";
import { uploadVideoToStorage } from "@/lib/uploadToStorage";
import {
  MAX_DOWNLOAD_FILENAME_LENGTH,
  PROGRESS_COMPLETE,
  PROGRESS_INDETERMINATE,
} from "@/lib/constants";


type YouTubeImportPhase =
  | "idle"
  | "fetching-info"  // getting video metadata via /api/youtube-info
  | "downloading"    // downloading video in browser
  | "uploading"      // uploading to Cloudinary then registering with backend
  | "done"
  | "error";

interface YouTubeImportState {
  phase:         YouTubeImportPhase;
  /** 0–100 during downloading/uploading; -1 = indeterminate */
  progress:      number;
  label:         string;
  error:         string | null;
  warning?:      string | null;
  videoTitle:    string | null;
  videoId:       string | null;
  cloudinaryUrl: string | null;
}

type YouTubeImportResult =
  | { videoId: string; cloudinaryUrl: string; error?: never }
  | { error: string; videoId?: never; cloudinaryUrl?: never };


function extractYouTubeId(url: string): string | null {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    const host = hostname.replace("www.", "");

    if (host === "youtu.be") {
      const id = pathname.slice(1).split("?")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com") {
      const v = searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const match = pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }
  } catch { /* invalid URL */ }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

//
// When the youtube-info route itself fails (private video, unavailable, etc.)
// there is no point falling back to the Render backend — it would hit the same
// wall and just produce a second confusing error.

class YouTubeInfoUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeInfoUnavailableError";
  }
}

//
// Calls our own Next.js route (runs on Vercel / locally) which uses youtubei.js
// to call InnerTube server-side. The Render backend is never involved here,
// so the "server IP blocked by YouTube" problem is completely avoided.

async function getYouTubeInfo(videoId: string): Promise<{
  title:           string;
  downloadUrl:     string;
  thumbnail:       string;
  durationSeconds: number;
  fileSizeBytes:   number | null;
  quality:         string;
}> {
  const res  = await fetch(`/api/youtube-info?videoId=${encodeURIComponent(videoId)}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg: string = data?.message ?? data?.error ?? `HTTP ${res.status}`;

    if (res.status === 403) {
      throw new YouTubeInfoUnavailableError(
        "This video is private or age-restricted. Try a public video, or upload the file directly."
      );
    }
    if (res.status === 404 || res.status === 422) {
      throw new YouTubeInfoUnavailableError(
        "YouTube video not found or unavailable. Please check the URL, or upload the video file directly."
      );
    }
    // 500 / 502 / network failure
    throw new YouTubeInfoUnavailableError(
      msg.toLowerCase().includes("unavailable") || msg.toLowerCase().includes("private")
        ? msg
        : "Could not resolve video info. Please try again, or upload your video file directly."
    );
  }

  if (!data?.downloadUrl) {
    throw new YouTubeInfoUnavailableError(
      "No downloadable format found for this video. " +
      "Please try again or upload your video file directly."
    );
  }

  return {
    title:           data.title           || `YouTube video ${videoId}`,
    downloadUrl:     data.downloadUrl,
    thumbnail:       data.thumbnail       || "",
    durationSeconds: data.durationSeconds || 0,
    fileSizeBytes:   data.fileSizeBytes   ?? null,
    quality:         data.quality         || "unknown",
  };
}

//
// Route through our Next.js /api/youtube-dl proxy to avoid CORS edge cases
// and to enforce the 2 GB size cap consistently.

function downloadVideo(
  url:        string,
  filename:   string,
  onProgress: (pct: number) => void
): Promise<File> {
  return new Promise((resolve, reject) => {
    const proxyUrl = `/api/youtube-dl?url=${encodeURIComponent(url)}`;

    const xhr = new XMLHttpRequest();
    xhr.open("GET", proxyUrl, true);
    xhr.responseType = "blob";

    xhr.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * PROGRESS_COMPLETE));
      } else {
        onProgress(PROGRESS_INDETERMINATE);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(new File([xhr.response as Blob], filename, { type: "video/mp4" }));
      } else {
        let msg = `Download failed (${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message || parsed?.error) msg = parsed.message ?? parsed.error;
        } catch { /* keep default */ }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during download."));
    xhr.onabort = () => reject(new Error("Download was cancelled."));
    xhr.send();
  });
}

//
// The browser uploads directly to Cloudinary (no Vercel 4.5 MB limit), then
// sends a small JSON payload to POST /videos/register so the backend can start
// AI processing.

async function uploadToBackend(
  file:       File,
  title:      string,
  onProgress: (pct: number) => void
): Promise<{ videoId: string; cloudinaryUrl: string }> {
  // 1. Direct hybrid upload (Cloudinary < 95MB, R2 >= 95MB)
  const storageResult = await uploadVideoToStorage(file, onProgress);

  // 2. Register with the backend (small JSON — no proxy size issue)
  const response = await apiClient.post("/videos/register", {
    cloudinaryUrl: storageResult.url,
    sourceUrl:     storageResult.url,
    publicId:      storageResult.publicId,
    title,
    sourceType:    "upload",
    style:         "viral",
    duration:      storageResult.duration,
    bytes:         storageResult.bytes,
  });

  const data = response.data;

  const videoId =
    data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId ?? null;

  const cloudinaryUrl =
    data?.video?.url ?? data?.url ?? data?.data?.url ?? data?.cloudinaryUrl
    ?? storageResult.url; // fall back to storage URL

  if (!videoId) {
    throw new Error("Upload succeeded but no video ID was returned.");
  }

  return { videoId: String(videoId), cloudinaryUrl };
}


function labelFor(phase: YouTubeImportPhase, progress: number): string {
  switch (phase) {
    case "fetching-info": return "Getting video info…";
    case "downloading":
      return progress >= 0
        ? `Downloading video… ${progress}%`
        : "Downloading video…";
    case "uploading":
      return `Uploading to Cloudinary… ${progress}%`;
    case "done":  return "Upload complete!";
    case "error": return "Import failed";
    default:      return "";
  }
}


const INITIAL: YouTubeImportState = {
  phase:         "idle",
  progress:      0,
  label:         "",
  error:         null,
  videoTitle:    null,
  videoId:       null,
  cloudinaryUrl: null,
};


/**
 * useYouTubeImport
 *
 * Full YouTube → ClipsCash import pipeline:
 *   1. Extract video ID from URL
 *   2. GET /api/youtube-info (Next.js route → youtubei.js InnerTube, server-side)
 *   3. Download video in browser via /api/youtube-dl proxy
 *   4. Upload file directly to Cloudinary, then register via POST /videos/register
 *   5. saveActiveJob + return { videoId, cloudinaryUrl }
 *
 * On any failure in steps 2–4, falls back to POST /videos/from-url (backend
 * handles the download itself). If the info step itself fails with
 * YouTubeInfoUnavailableError the fallback is skipped — no point re-trying.
 *
 * run() always returns the real result/error — never reads stale React state.
 */
export function useYouTubeImport() {
  const [state, setState] = useState<YouTubeImportState>(INITIAL);

  const set = useCallback(
    (patch: Partial<YouTubeImportState>) =>
      setState((prev) => ({ ...prev, ...patch })),
    []
  );

  const reset = useCallback(() => setState(INITIAL), []);

  const run = useCallback(
    async (url: string, targetPlatform: string): Promise<YouTubeImportResult> => {

      const videoId = extractYouTubeId(url);
      if (!videoId) {
        const error = "Could not extract a YouTube video ID from that URL.";
        set({ phase: "error", label: "Import failed", error });
        return { error };
      }

      try {
        set({ phase: "fetching-info", progress: 0, error: null,
              label: labelFor("fetching-info", 0) });

        const { downloadUrl, title: videoTitle } = await getYouTubeInfo(videoId);
        set({ videoTitle });

        set({ phase: "downloading", progress: 0,
              label: labelFor("downloading", 0) });

        const safeFilename =
          videoTitle
            .replace(/[^a-zA-Z0-9\s\-_]/g, "")
            .trim()
            .substring(0, MAX_DOWNLOAD_FILENAME_LENGTH) + ".mp4";

        const file = await downloadVideo(
          downloadUrl,
          safeFilename,
          (pct) => set({ progress: pct, label: labelFor("downloading", pct) })
        );

        set({ phase: "uploading", progress: 0,
              label: labelFor("uploading", 0) });

        const uploadResult = await uploadToBackend(
          file,
          videoTitle,
          (pct) => set({ progress: pct, label: labelFor("uploading", pct) })
        );

        saveActiveJob(uploadResult.videoId);
        markFreeJobAsClaimed();
        set({
          phase:         "done",
          progress:      PROGRESS_COMPLETE,
          label:         labelFor("done", PROGRESS_COMPLETE),
          videoId:       uploadResult.videoId,
          cloudinaryUrl: uploadResult.cloudinaryUrl,
        });

        return uploadResult;

      } catch (err: any) {

        if (err instanceof YouTubeInfoUnavailableError) {
          const friendly = err.message;
          set({ phase: "error", label: "Import failed", error: friendly });
          return { error: friendly };
        }

        try {
          set({ phase: "fetching-info", progress: 0,
                label: "Processing video on server…" });

          const response = await apiClient.post("/videos/from-url", {
            url:             url.trim(),
            targetPlatforms: [targetPlatform],
            style:           "viral",
          });

          const data           = response.data;
          const backendVideoId =
            data?.video?.id ?? data?.id ?? data?.data?.id ?? data?.videoId;
          const cloudinaryUrl  =
            data?.video?.url ?? data?.url ?? data?.data?.url ?? data?.cloudinaryUrl ?? null;

          if (!backendVideoId) {
            throw new Error("Backend download failed — no video ID returned.");
          }

          saveActiveJob(String(backendVideoId));
          markFreeJobAsClaimed();
          set({
            phase:         "done",
            progress:      PROGRESS_COMPLETE,
            label:         labelFor("done", PROGRESS_COMPLETE),
            videoId:       String(backendVideoId),
            cloudinaryUrl: cloudinaryUrl ?? "",
          });

          return { videoId: String(backendVideoId), cloudinaryUrl: cloudinaryUrl ?? "" };

        } catch {
          // Both the primary flow and the fallback failed — surface a friendly error.
          const status: number = (err as any)?.response?.status ?? 0;
          const raw: string    =
            err?.response?.data?.message ?? err?.message ?? "Import failed. Please try again.";
          const msg = Array.isArray(raw) ? raw[0] : raw;

          let friendly = msg;
          if (status === 401) {
            friendly = "Session expired — please log in and try again.";
          } else if (status === 403) {
            friendly = "This video is private or requires sign-in.";
          } else if (status === 404) {
            friendly = "Video not found or unavailable.";
          } else if (status === 429) {
            friendly = "Too many requests — please wait a moment and try again.";
          } else if (msg.toLowerCase().includes("private") || msg.toLowerCase().includes("unavailable")) {
            friendly = "This video is private or unavailable. Try a public video.";
          } else if (msg.toLowerCase().includes("network error") || msg.toLowerCase().includes("failed to fetch")) {
            friendly = "Network error — please check your connection and try again.";
          } else if (msg.toLowerCase().includes("download")) {
            friendly = "Failed to download video. The video might be region-restricted or unavailable.";
          } else {
            friendly = "Download failed. The video might be region-restricted or the service is temporarily unavailable.";
          }

          set({ phase: "error", label: "Import failed", error: friendly });
          return { error: friendly };
        }
      }
    },
    [set]
  );

  return { state, run, reset };
}
