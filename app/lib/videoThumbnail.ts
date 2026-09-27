/**
 * videoThumbnail.ts
 *
 * Client-side video thumbnail extraction via HTMLVideoElement + Canvas.
 *
 * Seeks a hidden <video> to each requested timestamp, draws the frame onto a
 * canvas, and exports it as a JPEG data URI. All three steps (load, seek,
 * draw) happen off-screen; no DOM insertion is needed.
 *
 * Results are cached by a stable file key (name + size + lastModified) so
 * repeated calls for the same File never re-seek.
 */

/** JPEG quality for exported thumbnails — 0.75 balances size vs. fidelity. */
const THUMBNAIL_QUALITY = 0.75;

/** Thumbnail width in pixels; height is derived from the video's aspect ratio. */
const THUMBNAIL_WIDTH = 320;

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
  const aspectRatio =
    video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
  const width = THUMBNAIL_WIDTH;
  const height = Math.round(width / aspectRatio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(video, 0, 0, width, height);
  }

  return canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY);
}

/**
 * Generate thumbnail data URIs for a video File.
 *
 * Extracts frames at `positions` (fractions 0–1 of total duration).
 * Returns cached results on repeated calls for the same file.
 *
 * @param file       The video File to extract frames from.
 * @param positions  Fractional seek positions, e.g. [0.05, 0.5, 0.95].
 */
export async function generateVideoThumbnails(
  file: File,
  positions: number[] = [0.05, 0.5, 0.95],
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

    const thumbnails: string[] = [];

    for (const pos of positions) {
      const time = Math.max(0, Math.min(duration * pos, duration - 0.1));
      await seekTo(video, time);
      thumbnails.push(captureFrame(video));
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
