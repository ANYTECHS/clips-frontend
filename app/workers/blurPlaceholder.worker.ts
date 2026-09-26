/**
 * Web worker for generating blur-placeholder images off the main thread.
 *
 * `generateBlurPlaceholder` in app/lib/imageUtils.ts draws a gradient onto a
 * `<canvas>` and encodes it with `toDataURL`, both on the main thread. That's
 * fine for a single 10x10 thumbnail, but doesn't scale if a grid ever needs
 * many placeholders at once (e.g. per-clip gradients instead of one shared
 * static placeholder). This worker does the same drawing + encoding on an
 * `OffscreenCanvas` instead, so it never touches the main thread.
 */

export interface BlurPlaceholderRequest {
  requestId: number;
  width: number;
  height: number;
}

export interface BlurPlaceholderResponse {
  requestId: number;
  dataUrl: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

self.onmessage = async (event: MessageEvent<BlurPlaceholderRequest>) => {
  const { requestId, width, height } = event.data;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#2a2a2a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.1 });
  const dataUrl = await blobToDataUrl(blob);

  const response: BlurPlaceholderResponse = { requestId, dataUrl };
  (self as unknown as Worker).postMessage(response);
};

export {};
