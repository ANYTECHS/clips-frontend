/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";

jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn(),
}));
import {
  compressResponse,
  negotiateEncoding,
  decompressRequestBody,
  compressBuffer,
  decompressBuffer,
  __resetCompressionConfig,
  type SupportedEncoding,
} from "@/app/lib/apiCompression";
import { withApiMiddleware } from "@/app/lib/apiMiddleware";

describe("API Response Compression (Issue #1250)", () => {
  beforeEach(() => {
    delete process.env.COMPRESSION_ENABLED;
    delete process.env.COMPRESSION_MIN_BYTES;
    delete process.env.BROTLI_COMPRESSION_LEVEL;
    delete process.env.GZIP_COMPRESSION_LEVEL;
    __resetCompressionConfig();
  });

  describe("negotiateEncoding", () => {
    it("prefers brotli over gzip when both are offered without explicit q", () => {
      expect(negotiateEncoding("gzip, deflate, br")).toBe("br");
      expect(negotiateEncoding("br, gzip")).toBe("br");
    });

    it("falls back to gzip when brotli is not accepted", () => {
      expect(negotiateEncoding("gzip, deflate")).toBe("gzip");
    });

    it("falls back to deflate when only deflate is accepted", () => {
      expect(negotiateEncoding("deflate")).toBe("deflate");
    });

    it("respects quality values when gzip has higher priority than brotli", () => {
      expect(negotiateEncoding("gzip;q=1.0, br;q=0.5")).toBe("gzip");
    });

    it("excludes algorithms with q=0", () => {
      expect(negotiateEncoding("br;q=0, gzip;q=0.8")).toBe("gzip");
      expect(negotiateEncoding("br;q=0, gzip;q=0")).toBe("identity");
    });

    it("handles wildcard and identity properly", () => {
      expect(negotiateEncoding("*;q=0")).toBe("identity");
      expect(negotiateEncoding("identity")).toBe("identity");
      expect(negotiateEncoding("")).toBe("identity");
      expect(negotiateEncoding(null)).toBe("identity");
    });
  });

  describe("compressResponse threshold and exclusions", () => {
    it("does not compress bodies smaller than or equal to 1024 bytes", async () => {
      const smallData = { message: "hello".repeat(100) }; // ~500 bytes
      const jsonString = JSON.stringify(smallData);
      expect(Buffer.byteLength(jsonString)).toBeLessThanOrEqual(1024);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { "accept-encoding": "br, gzip" },
      });
      const res = NextResponse.json(smallData);

      const compressed = await compressResponse(req, res);
      expect(compressed.headers.get("content-encoding")).toBeNull();
    });

    it("compresses bodies larger than 1024 bytes with Brotli", async () => {
      const largeData = { items: Array.from({ length: 50 }, (_, i) => ({ id: i, text: `Item description ${i} with extra text to exceed 1kb` })) };
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "accept-encoding": "br, gzip" },
      });
      const res = NextResponse.json(largeData);

      const compressed = await compressResponse(req, res);
      expect(compressed.headers.get("content-encoding")).toBe("br");
      expect(compressed.headers.get("vary")).toContain("Accept-Encoding");

      const bodyBuffer = await compressed.arrayBuffer();
      const decompressed = await decompressBuffer(new Uint8Array(bodyBuffer), "br");
      const parsed = JSON.parse(new TextDecoder().decode(decompressed));
      expect(parsed).toEqual(largeData);
    });

    it("merges with existing Vary header", async () => {
      const largeData = { data: "a".repeat(2000) };
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "accept-encoding": "br" },
      });
      const res = new NextResponse(JSON.stringify(largeData), {
        headers: {
          "content-type": "application/json",
          "vary": "X-Custom-Header, User-Agent",
        },
      });

      const compressed = await compressResponse(req, res);
      const vary = compressed.headers.get("vary");
      expect(vary).toContain("X-Custom-Header");
      expect(vary).toContain("User-Agent");
      expect(vary).toContain("Accept-Encoding");
    });

    it("does not compress already-compressed responses", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        headers: { "accept-encoding": "br" },
      });
      const res = new NextResponse(new Uint8Array(2000), {
        headers: { "content-encoding": "gzip" },
      });

      const compressed = await compressResponse(req, res);
      expect(compressed.headers.get("content-encoding")).toBe("gzip");
    });

    it("does not compress Server-Sent Events (SSE)", async () => {
      const req = new NextRequest("http://localhost/api/sse", {
        headers: { "accept-encoding": "br, gzip" },
      });
      const res = new NextResponse("data: test event\n\n".repeat(100), {
        headers: { "content-type": "text/event-stream" },
      });

      const compressed = await compressResponse(req, res);
      expect(compressed.headers.get("content-encoding")).toBeNull();
    });

    it("does not compress images or media content-types", async () => {
      const req = new NextRequest("http://localhost/api/image", {
        headers: { "accept-encoding": "br, gzip" },
      });
      const res = new NextResponse(new Uint8Array(2000), {
        headers: { "content-type": "image/png" },
      });

      const compressed = await compressResponse(req, res);
      expect(compressed.headers.get("content-encoding")).toBeNull();
    });

    it("does not compress status 204 or 304 or HEAD requests", async () => {
      const reqHead = new NextRequest("http://localhost/api/test", {
        method: "HEAD",
        headers: { "accept-encoding": "br" },
      });
      const resHead = new NextResponse(null, { status: 200 });
      const compHead = await compressResponse(reqHead, resHead);
      expect(compHead.headers.get("content-encoding")).toBeNull();

      const reqGet = new NextRequest("http://localhost/api/test", {
        headers: { "accept-encoding": "br" },
      });
      const res204 = new NextResponse(null, { status: 204 });
      const comp204 = await compressResponse(reqGet, res204);
      expect(comp204.headers.get("content-encoding")).toBeNull();
    });
  });

  describe("apiMiddleware integration", () => {
    it("applies compression automatically through withApiMiddleware", async () => {
      const largePayload = { list: Array.from({ length: 50 }, (_, i) => ({ id: i, label: `Job entry #${i} status completed` })) };

      const handler = withApiMiddleware(
        () => NextResponse.json(largePayload),
        { requireAuth: false }
      );

      const req = new NextRequest("http://localhost/api/jobs", {
        headers: { "accept-encoding": "br, gzip" },
      });

      const response = await handler(req);
      expect(response.headers.get("content-encoding")).toBe("br");
      expect(response.headers.get("vary")).toContain("Accept-Encoding");
    });
  });

  describe("Performance Benchmark & 100 KB JSON Fixture", () => {
    it("compresses a 100 KB realistic JSON fixture to under 20 KB using Brotli", async () => {
      // Build a realistic ~100 KB list-endpoint JSON payload (e.g. clip list with metadata, tags, analytics)
      const fixtureItems = [];
      for (let i = 0; i < 220; i++) {
        fixtureItems.push({
          id: `clip_${i.toString().padStart(6, "0")}`,
          userId: "user_cl789xyz12345",
          title: `Viral TikTok Moment #${i} - Exciting Highlights and Best Gaming Plays`,
          description: `Comprehensive analysis of clip #${i} featuring high engagement, detected laughter, and fast-paced speech patterns.`,
          durationSeconds: 42.5,
          resolution: { width: 1080, height: 1920, fps: 60 },
          tags: ["gaming", "viral", "highlights", "clipcash", "streamer", "humor"],
          scores: { viralScore: 94.2, hookScore: 88.0, engagement: 91.5, trendingProbability: 0.87 },
          metadata: {
            codec: "h264",
            bitrate: 4500000,
            hasAudio: true,
            audioChannels: 2,
            sampleRate: 48000,
          },
          analytics: {
            views: 125400 + i * 150,
            likes: 18200 + i * 20,
            shares: 3400 + i * 5,
            bookmarks: 1200 + i * 2,
          },
          status: "published",
          createdAt: new Date(1700000000000 + i * 60000).toISOString(),
          updatedAt: new Date(1700000000000 + i * 60000 + 15000).toISOString(),
        });
      }

      const jsonPayload = JSON.stringify({
        success: true,
        data: fixtureItems,
        pagination: { page: 1, limit: 220, total: 220, totalPages: 1 },
      });

      const originalBytes = new TextEncoder().encode(jsonPayload);
      const originalSize = originalBytes.byteLength;
      expect(originalSize).toBeGreaterThan(100 * 1024); // Exceeds 100 KB

      // Brotli Compression Benchmark
      const startBrotli = performance.now();
      const brotliCompressed = await compressBuffer(originalBytes, "br");
      const durationBrotli = performance.now() - startBrotli;
      const brotliSize = brotliCompressed.byteLength;

      // Gzip Compression Benchmark
      const startGzip = performance.now();
      const gzipCompressed = await compressBuffer(originalBytes, "gzip");
      const durationGzip = performance.now() - startGzip;
      const gzipSize = gzipCompressed.byteLength;

      // Acceptance Criteria: 100 KB fixture compresses to under 20 KB with Brotli
      expect(brotliSize).toBeLessThan(20 * 1024); // Under 20 KB
      expect(gzipSize).toBeLessThan(35 * 1024);

      // Verify lossless roundtrip decompression
      const decompressedBrotli = await decompressBuffer(brotliCompressed, "br");
      expect(JSON.parse(new TextDecoder().decode(decompressedBrotli))).toEqual(JSON.parse(jsonPayload));

      const brotliReduction = ((1 - brotliSize / originalSize) * 100).toFixed(2);
      const gzipReduction = ((1 - gzipSize / originalSize) * 100).toFixed(2);

      // Log reproducible benchmark observations
      console.log("=== COMPRESSION PERFORMANCE BENCHMARK ===");
      console.log(`Original JSON size:    ${(originalSize / 1024).toFixed(2)} KB (${originalSize} bytes)`);
      console.log(`Brotli (level 4) size: ${(brotliSize / 1024).toFixed(2)} KB (${brotliSize} bytes) [${brotliReduction}% reduction in ${durationBrotli.toFixed(2)}ms]`);
      console.log(`Gzip   (level 6) size: ${(gzipSize / 1024).toFixed(2)} KB (${gzipSize} bytes) [${gzipReduction}% reduction in ${durationGzip.toFixed(2)}ms]`);
      console.log("=========================================");
    });
  });
});
