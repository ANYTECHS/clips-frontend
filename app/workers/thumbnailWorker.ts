/**
 * Web worker for video thumbnail encoding off the main thread.
 *
 * `generateVideoThumbnails` in app/lib/videoThumbnail.ts used to draw every
 * seeked frame onto a `<canvas>` and encode it with `toDataURL`, both
 * synchronously on the main thread — for a large 4K source that's a visible
 * stall per frame. Video demuxing still needs an `HTMLVideoElement` (there is
 * no video element in a worker), but seeking is asynchronous and
 * `createImageBitmap(video)` hands the decoded frame over without blocking.
 * This worker receives the video blob alongside those frame bitmaps and does
 * the scaling and JPEG encoding on an `OffscreenCanvas`, so the main thread
 * never rasterises or encodes.
 *
 * Requests are independent and identified by `requestId`, so several files
 * can be in flight at once without waiting on each other.
 */

/** JPEG quality for exported thumbnails — 0.75 balances size vs. fidelity. */
export const THUMBNAIL_QUALITY = 0.75;

/** Thumbnail width in pixels; height is derived from the video's aspect ratio. */
export const THUMBNAIL_WIDTH = 320;

export const THUMBNAIL_MIME_TYPE = "image/jpeg";

export interface ThumbnailWorkerRequest {
  requestId: number;
  /** The source video. Used for its type/size in diagnostics; frames carry the pixels. */
  video: Blob;
  /** One decoded frame per requested position, transferred (not copied). */
  frames: ImageBitmap[];
  /** Output width in pixels. Default THUMBNAIL_WIDTH. */
  width?: number;
  /** JPEG quality in [0, 1]. Default THUMBNAIL_QUALITY. */
  quality?: number;
}

export type ThumbnailWorkerResponse =
  | {
      requestId: number;
      ok: true;
      /** JPEG data URLs, in the same order as `frames`. */
      thumbnails: string[];
      width: number;
      height: number;
    }
  | { requestId: number; ok: false; error: string };

/**
 * Output size for a frame scaled to `targetWidth`, preserving aspect ratio.
 * Falls back to 16:9 when the source has no usable dimensions.
 */
export function thumbnailDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number = THUMBNAIL_WIDTH,
): { width: number; height: number } {
  const aspectRatio =
    sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
  return { width: targetWidth, height: Math.max(1, Math.round(targetWidth / aspectRatio)) };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function encodeFrame(
  frame: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<string> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, 0, 0, width, height);
  }
  frame.close();

  const blob = await canvas.convertToBlob({ type: THUMBNAIL_MIME_TYPE, quality });
  return blobToDataUrl(blob);
}

/** Process one request. Exported so it can be unit tested without a worker. */
export async function handleThumbnailRequest(
  request: ThumbnailWorkerRequest,
): Promise<ThumbnailWorkerResponse> {
  const { requestId, frames, width: targetWidth = THUMBNAIL_WIDTH, quality = THUMBNAIL_QUALITY } =
    request;

  try {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas is not supported in this worker");
    }
    if (frames.length === 0) {
      return { requestId, ok: true, thumbnails: [], ...thumbnailDimensions(0, 0, targetWidth) };
    }

    const { width, height } = thumbnailDimensions(frames[0].width, frames[0].height, targetWidth);
    const thumbnails = await Promise.all(
      frames.map((frame) => encodeFrame(frame, width, height, quality)),
    );
    return { requestId, ok: true, thumbnails, width, height };
  } catch (err) {
    for (const frame of frames) frame.close();
    return {
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : "Thumbnail encoding failed",
    };
  }
}

// Only wire up the message handler inside an actual worker: the constants and
// helpers above are also imported on the main thread (and in tests), where
// assigning `self.onmessage` would hijack the window's message channel.
if (typeof window === "undefined" && typeof self !== "undefined") {
  self.onmessage = async (event: MessageEvent<ThumbnailWorkerRequest>) => {
    const response = await handleThumbnailRequest(event.data);
    (self as unknown as Worker).postMessage(response);
  };
}
