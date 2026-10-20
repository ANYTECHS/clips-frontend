/**
 * Web worker for video metadata processing (#1269).
 *
 * Processes video metadata data off the main thread. The actual metadata
 * extraction (via video element) must happen on the main thread, but
 * calculations and transformations can be done here.
 */

export interface VideoMetadataProcessRequest {
  requestId: number;
  videos: Array<{
    duration: number;
    width: number;
    height: number;
  }>;
  operation: "filter" | "sort" | "transform";
  filter?: {
    minDuration?: number;
    maxWidth?: number;
    maxHeight?: number;
  };
}

export interface VideoMetadataProcessResponse {
  requestId: number;
  result?: Array<{
    duration: number;
    width: number;
    height: number;
    aspectRatio: number;
    resolution: string;
  }>;
  error?: string;
}

self.onmessage = (event: MessageEvent<VideoMetadataProcessRequest>) => {
  const { requestId, videos, operation, filter } = event.data;

  try {
    let processed = videos.map((v) => ({
      ...v,
      aspectRatio: v.width / v.height,
      resolution: `${v.width}x${v.height}`,
    }));

    if (operation === "filter" && filter) {
      processed = processed.filter((v) => {
        if (filter.minDuration && v.duration < filter.minDuration) return false;
        if (filter.maxWidth && v.width > filter.maxWidth) return false;
        if (filter.maxHeight && v.height > filter.maxHeight) return false;
        return true;
      });
    }

    if (operation === "sort") {
      processed.sort((a, b) => b.duration - a.duration);
    }

    const response: VideoMetadataProcessResponse = { requestId, result: processed };
    (self as unknown as Worker).postMessage(response);
  } catch (error) {
    const response: VideoMetadataProcessResponse = {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    (self as unknown as Worker).postMessage(response);
  }
};

export {};
