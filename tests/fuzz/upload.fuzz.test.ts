/**
 * @jest-environment node
 */
import fc from "fast-check";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: "fuzz-user-123" } }),
}));

jest.mock("@/app/lib/csrf", () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
}));

jest.mock("@/app/lib/serverRateLimit", () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/app/lib/cloudStorage", () => ({
  uploadToQuarantine: jest.fn().mockResolvedValue({
    jobId: "fuzz-job-123",
    filename: "video.mp4",
    quarantineKey: "uploads/quarantine/video.mp4",
  }),
  moveFromQuarantine: jest.fn().mockResolvedValue({
    jobId: "fuzz-job-123",
    filename: "video.mp4",
    objectKey: "uploads/video.mp4",
    url: "https://cdn.example.com/video.mp4",
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/virusScan", () => ({
  scanFile: jest.fn().mockResolvedValue({ isClean: true, provider: "mock" }),
  getScanConfig: jest.fn().mockReturnValue({ enabled: true, provider: "mock" }),
  VirusScanError: class VirusScanError extends Error {},
}));

jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true, remoteJobId: "fuzz-job-123" }),
}));

const APP_ORIGIN = "http://localhost:3000";
const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024; // 524,288,000 bytes

const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];

function isValidMagicBytes(buffer: Uint8Array, declaredType: string): boolean {
  if (buffer.length < 12) return false;

  const headerStr = Array.from(buffer.subarray(0, 12))
    .map((b) => String.fromCharCode(b))
    .join("");

  const isFtyp = headerStr.includes("ftyp");
  const isAvi = headerStr.startsWith("RIFF") && headerStr.includes("AVI");
  const isMkv =
    buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;

  return isFtyp || isAvi || isMkv;
}

function isValidFileValidation(fileName: string, mimeType: string, size: number): boolean {
  if (size > MAX_UPLOAD_SIZE_BYTES) return false;

  const ext = "." + (fileName.split(".").pop()?.toLowerCase() ?? "");
  const typeAllowed = ALLOWED_TYPES.includes(mimeType);
  const extAllowed = ALLOWED_EXTENSIONS.includes(ext);

  return typeAllowed || extAllowed;
}

function makeUploadRequest(file: File) {
  const formData = new FormData();
  formData.append("files", file);
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
    headers: { origin: APP_ORIGIN },
  });
}

beforeEach(() => {
  process.env.NEXTAUTH_URL = APP_ORIGIN;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Upload Validation Fuzzing Suite (#807)", () => {
  it("rejects all 1000 adversarial generated invalid upload cases with HTTP 400", async () => {
    const invalidFileNameArb = fc.oneof(
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.exe`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.txt`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.sh`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.php`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.js`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.png`)
    );

    const validFileNameArb = fc.oneof(
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.mp4`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.mov`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.avi`),
      fc.stringOf(fc.alphanumeric(), { minLength: 1, maxLength: 10 }).map((s) => `${s}.mkv`)
    );

    const fileNameArb = fc.oneof(invalidFileNameArb, validFileNameArb);

    const mimeTypeArb = fc.oneof(
      fc.constant("video/mp4"),
      fc.constant("video/quicktime"),
      fc.constant("video/x-msvideo"),
      fc.constant("video/x-matroska"),
      fc.constant("application/octet-stream"),
      fc.constant("text/plain"),
      fc.constant("application/x-msdownload"),
      fc.constant("image/png")
    );

    // File sizes around 500 MB boundary (524,288,000 bytes)
    const boundarySizeArb = fc.oneof(
      fc.integer({ min: 0, max: 1024 }),
      fc.integer({ min: MAX_UPLOAD_SIZE_BYTES - 1000, max: MAX_UPLOAD_SIZE_BYTES + 1000 }),
      fc.integer({ min: MAX_UPLOAD_SIZE_BYTES + 1, max: MAX_UPLOAD_SIZE_BYTES * 2 })
    );

    const bufferArb = fc.uint8Array({ minLength: 0, maxLength: 64 });

    await fc.assert(
      fc.asyncProperty(
        fileNameArb,
        mimeTypeArb,
        boundarySizeArb,
        bufferArb,
        async (fileName, mimeType, simulatedSize, buffer) => {
          const file = new File([buffer], fileName, { type: mimeType });
          if (simulatedSize !== buffer.length) {
            Object.defineProperty(file, "size", { value: simulatedSize });
          }

          const isFileValid = isValidFileValidation(fileName, mimeType, simulatedSize);
          const isMagicValid = isValidMagicBytes(buffer, mimeType);
          const isOverallValid = isFileValid && isMagicValid;

          const req = makeUploadRequest(file);
          const res = await POST(req);

          if (!isOverallValid) {
            expect(res.status).toBe(400);
          } else {
            expect(res.status).toBe(200);
          }
        }
      ),
      { numRuns: 1000 }
    );
  });
});
