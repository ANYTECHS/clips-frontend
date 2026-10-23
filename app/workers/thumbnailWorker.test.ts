import {
  THUMBNAIL_MIME_TYPE,
  THUMBNAIL_WIDTH,
  handleThumbnailRequest,
  thumbnailDimensions,
} from "./thumbnailWorker";

/** Minimal OffscreenCanvas stand-in that records what it was asked to draw. */
class FakeOffscreenCanvas {
  static instances: FakeOffscreenCanvas[] = [];
  drawn: Array<{ width: number; height: number }> = [];

  constructor(public width: number, public height: number) {
    FakeOffscreenCanvas.instances.push(this);
  }

  getContext() {
    return {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      drawImage: (_source: unknown, _x: number, _y: number, width: number, height: number) => {
        this.drawn.push({ width, height });
      },
    };
  }

  convertToBlob({ type }: { type: string; quality?: number }) {
    return Promise.resolve(new Blob(["jpeg-bytes"], { type }));
  }
}

function fakeFrame(width: number, height: number) {
  return { width, height, close: jest.fn() } as unknown as ImageBitmap;
}

const video = new Blob(["video"], { type: "video/mp4" });

describe("thumbnailWorker", () => {
  const original = (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;

  beforeEach(() => {
    FakeOffscreenCanvas.instances = [];
    (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeOffscreenCanvas;
  });

  afterEach(() => {
    (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = original;
  });

  describe("thumbnailDimensions", () => {
    it("scales to the target width and preserves aspect ratio", () => {
      expect(thumbnailDimensions(1920, 1080, 320)).toEqual({ width: 320, height: 180 });
      expect(thumbnailDimensions(1080, 1920, 320)).toEqual({ width: 320, height: 569 });
    });

    it("falls back to 16:9 when the source has no dimensions", () => {
      expect(thumbnailDimensions(0, 0)).toEqual({ width: THUMBNAIL_WIDTH, height: 180 });
    });
  });

  describe("handleThumbnailRequest", () => {
    it("returns one JPEG data URL per frame at thumbnail dimensions", async () => {
      const frames = [fakeFrame(3840, 2160), fakeFrame(3840, 2160), fakeFrame(3840, 2160)];

      const response = await handleThumbnailRequest({ requestId: 7, video, frames });

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.requestId).toBe(7);
      expect(response.width).toBe(320);
      expect(response.height).toBe(180);
      expect(response.thumbnails).toHaveLength(3);
      for (const url of response.thumbnails) {
        expect(url.startsWith(`data:${THUMBNAIL_MIME_TYPE};base64,`)).toBe(true);
      }
      for (const canvas of FakeOffscreenCanvas.instances) {
        expect(canvas.width).toBe(320);
        expect(canvas.height).toBe(180);
        expect(canvas.drawn).toEqual([{ width: 320, height: 180 }]);
      }
    });

    it("honours a custom width", async () => {
      const response = await handleThumbnailRequest({
        requestId: 1,
        video,
        frames: [fakeFrame(1000, 500)],
        width: 160,
      });

      expect(response).toMatchObject({ ok: true, width: 160, height: 80 });
    });

    it("releases every frame bitmap", async () => {
      const frames = [fakeFrame(640, 360), fakeFrame(640, 360)];

      await handleThumbnailRequest({ requestId: 1, video, frames });

      for (const frame of frames) expect(frame.close).toHaveBeenCalled();
    });

    it("handles concurrent requests independently", async () => {
      const [a, b] = await Promise.all([
        handleThumbnailRequest({ requestId: 1, video, frames: [fakeFrame(1920, 1080)] }),
        handleThumbnailRequest({ requestId: 2, video, frames: [fakeFrame(1080, 1080)] }),
      ]);

      expect(a).toMatchObject({ requestId: 1, ok: true, height: 180 });
      expect(b).toMatchObject({ requestId: 2, ok: true, height: 320 });
    });

    it("reports an error when OffscreenCanvas is unavailable", async () => {
      delete (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas;
      const frames = [fakeFrame(640, 360)];

      const response = await handleThumbnailRequest({ requestId: 3, video, frames });

      expect(response).toMatchObject({ requestId: 3, ok: false });
      expect(frames[0].close).toHaveBeenCalled();
    });
  });
});
