/**
 * videoThumbnail.ts
 *
 * Client-side video thumbnail extraction via HTMLVideoElement + Canvas.
 *
 * Seeks a hidden <video> to each requested timestamp, draws the frame onto a
 * canvas, and exports it as a JPEG data URI. All three steps (load, seek,
 * draw) happen off-screen; no DOM insertion is needed.
 *
 * When a `ThumbnailWorkerClient` is supplied (see `createThumbnailWorker`),
 * each seeked frame is grabbed with `createImageBitmap` and transferred to
 * app/workers/thumbnailWorker.ts, which scales and encodes it on an
 * `OffscreenCanvas`. The main thread then only seeks — the synchronous
 * draw + `toDataURL` work that caused jank on large videos moves off it.
 * Without a worker (unsupported browser, SSR, jsdom) the original
 * main-thread canvas path is used.
 *
 * Results are cached by a stable file key (name + size + lastModified) so
 * repeated calls for the same File never re-seek.
 */

import {
  THUMBNAIL_MIME_TYPE,
  THUMBNAIL_QUALITY,
  THUMBNAIL_WIDTH,
  thumbnailDimensions,
  type ThumbnailWorkerRequest,
  type ThumbnailWorkerResponse,
} from "@/app/workers/thumbnailWorker";

/** Maximum time (ms) to wait for a seek to settle. */
const SEEK_TIMEOUT_MS = 8_000;

/** Stable cache key for a File. */
function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Module-level cache — persists across hook mount/unmount cycles. */
const thumbnailCache = new Map<string, string[]>();

/**
 * Seek a video element to `time` seconds and resolve once the frame is ready.
 * Rejects after SEEK_TIMEOUT_MS if the seek never settles.
 */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Seek to ${time}s timed out`));
    }, SEEK_TIMEOUT_MS);

    const onSeeked = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Draw the current video frame onto a canvas and return a JPEG data URI.
 */
function captureFrame(video: HTMLVideoElement): string {
  const { width, height } = thumbnailDimensions(
    video.videoWidth,
    video.videoHeight,
    THUMBNAIL_WIDTH,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(video, 0, 0, width, height);
  }

  return canvas.toDataURL(THUMBNAIL_MIME_TYPE, THUMBNAIL_QUALITY);
}

// ─── Worker client ────────────────────────────────────────────────────────────

/** Handle to a thumbnail worker; see `createThumbnailWorker`. */
export interface ThumbnailWorkerClient {
  /** Encode decoded frames into JPEG data URIs. Frames are transferred to the worker. */
  encode(video: Blob, frames: ImageBitmap[]): Promise<string[]>;
  terminate(): void;
}

/** True when frames can be grabbed and encoded off the main thread. */
export function supportsThumbnailWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

/**
 * Spawn a thumbnail worker, or return `null` where workers / OffscreenCanvas
 * are unavailable so callers fall back to main-thread extraction. Requests
 * are multiplexed by id, so concurrent `encode` calls don't wait on each other.
 */
export function createThumbnailWorker(): ThumbnailWorkerClient | null {
  if (!supportsThumbnailWorker()) return null;

  let worker: Worker;
  try {
    worker = new Worker(new URL("../workers/thumbnailWorker.ts", import.meta.url));
  } catch {
    return null;
  }

  let nextRequestId = 0;
  const pending = new Map<
    number,
    { resolve: (thumbnails: string[]) => void; reject: (err: Error) => void }
  >();

  worker.onmessage = (event: MessageEvent<ThumbnailWorkerResponse>) => {
    const request = pending.get(event.data.requestId);
    if (!request) return;
    pending.delete(event.data.requestId);
    if (event.data.ok) {
      request.resolve(event.data.thumbnails);
    } else {
      request.reject(new Error(event.data.error));
    }
  };

  worker.onerror = (event: ErrorEvent) => {
    const error = new Error(event.message || "Thumbnail worker crashed");
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  return {
    encode(video, frames) {
      const requestId = ++nextRequestId;
      return new Promise<string[]>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        const message: ThumbnailWorkerRequest = {
          requestId,
          video,
          frames,
          width: THUMBNAIL_WIDTH,
          quality: THUMBNAIL_QUALITY,
        };
        worker.postMessage(message, frames);
      });
    },
    terminate() {
      worker.terminate();
      const error = new Error("Thumbnail worker terminated");
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    },
  };
}

export interface GenerateVideoThumbnailsOptions {
  /** Encode frames off the main thread. Omit (or pass null) for main-thread extraction. */
  worker?: ThumbnailWorkerClient | null;
}

/**
 * Generate thumbnail data URIs for a video File.
 *
 * Extracts frames at `positions` (fractions 0–1 of total duration).
 * Returns cached results on repeated calls for the same file.
 *
 * @param file       The video File to extract frames from.
 * @param positions  Fractional seek positions, e.g. [0.05, 0.5, 0.95].
 * @param options    `worker` to encode frames off the main thread.
 */
export async function generateVideoThumbnails(
  file: File,
  positions: number[] = [0.05, 0.5, 0.95],
  options: GenerateVideoThumbnailsOptions = {},
): Promise<string[]> {
  const key = fileKey(file);

  if (thumbnailCache.has(key)) {
    return thumbnailCache.get(key)!;
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";

  try {
    // Wait for enough metadata to know the duration
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Metadata load timed out")), SEEK_TIMEOUT_MS);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Failed to load video metadata"));
      };
      video.src = objectUrl;
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Could not determine video duration");
    }

    const times = positions.map((pos) =>
      Math.max(0, Math.min(duration * pos, duration - 0.1)),
    );

    let thumbnails: string[] | null = null;

    if (options.worker) {
      try {
        const frames: ImageBitmap[] = [];
        for (const time of times) {
          await seekTo(video, time);
          frames.push(await createImageBitmap(video));
        }
        thumbnails = await options.worker.encode(file, frames);
      } catch {
        // Worker or bitmap capture failed — fall back to the main thread.
        thumbnails = null;
      }
    }

    if (!thumbnails) {
      thumbnails = [];
      for (const time of times) {
        await seekTo(video, time);
        thumbnails.push(captureFrame(video));
      }
    }

    thumbnailCache.set(key, thumbnails);
    return thumbnails;
  } finally {
    // Release the media resource regardless of success/failure
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Remove a file's thumbnails from the cache.
 * Call this when the file is removed from the upload queue.
 */
export function evictThumbnailCache(file: File): void {
  thumbnailCache.delete(fileKey(file));
}
