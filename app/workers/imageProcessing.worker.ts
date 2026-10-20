/**
 * Web worker for image processing and transformation (#1269).
 *
 * Processes image data off the main thread. Uses OffscreenCanvas
 * for browser-native image processing where available.
 */

export interface ImageProcessRequest {
  requestId: number;
  operation: "grayscale" | "brightness" | "contrast";
  imageData: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };
  value?: number; // For brightness/contrast: -100 to 100
}

export interface ImageProcessResponse {
  requestId: number;
  processedData?: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };
  error?: string;
}

self.onmessage = (event: MessageEvent<ImageProcessRequest>) => {
  const { requestId, operation, imageData, value = 0 } = event.data;

  try {
    const { width, height, data } = imageData;
    const processedData = new Uint8ClampedArray(data);

    if (operation === "grayscale") {
      for (let i = 0; i < processedData.length; i += 4) {
        const avg = (processedData[i] + processedData[i + 1] + processedData[i + 2]) / 3;
        processedData[i] = avg; // R
        processedData[i + 1] = avg; // G
        processedData[i + 2] = avg; // B
      }
    } else if (operation === "brightness") {
      const adjustment = value * 2.55; // Convert -100 to 100 range to -255 to 255
      for (let i = 0; i < processedData.length; i += 4) {
        processedData[i] = Math.min(255, Math.max(0, processedData[i] + adjustment));
        processedData[i + 1] = Math.min(255, Math.max(0, processedData[i + 1] + adjustment));
        processedData[i + 2] = Math.min(255, Math.max(0, processedData[i + 2] + adjustment));
      }
    } else if (operation === "contrast") {
      const factor = (259 * (value + 255)) / (255 * (259 - value));
      for (let i = 0; i < processedData.length; i += 4) {
        processedData[i] = Math.min(255, Math.max(0, factor * (processedData[i] - 128) + 128));
        processedData[i + 1] = Math.min(255, Math.max(0, factor * (processedData[i + 1] - 128) + 128));
        processedData[i + 2] = Math.min(255, Math.max(0, factor * (processedData[i + 2] - 128) + 128));
      }
    }

    const response: ImageProcessResponse = {
      requestId,
      processedData: { width, height, data: processedData },
    };
    (self as unknown as Worker).postMessage(response, [processedData.buffer]);
  } catch (error) {
    const response: ImageProcessResponse = {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    (self as unknown as Worker).postMessage(response);
  }
};

export {};
