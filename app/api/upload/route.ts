/**
 * /api/upload/route.ts — Issue #442
 *
 * Real cloud-storage upload endpoint.
 *
 * Files are validated, converted to a Buffer, then stored in the configured
 * S3-compatible bucket (AWS S3, Cloudflare R2, or GCS S3 interop) via
 * app/lib/cloudStorage.ts.  The response includes a stable jobId tied to the
 * stored object so downstream AI processing can reference it.
 *
 * File size limit: 500 MB (hard-rejected before any storage call).
 *
 * Environment variables required (see app/lib/cloudStorage.ts for full list):
 *   CLOUD_STORAGE_BUCKET, CLOUD_STORAGE_REGION, AWS_ACCESS_KEY_ID,
 *   AWS_SECRET_ACCESS_KEY
 *
 * Optional:
 *   CLOUD_STORAGE_ENDPOINT   — for R2 / GCS S3 interop
 *   CLOUD_STORAGE_KEY_PREFIX — object key prefix (default: "uploads/")
 *
 * Malware scanning:
 *   Full malware scanning (ClamAV / third-party API) is a future requirement.
 *   Files are currently stored unscanned.  See docs/SECURITY.md for the
 *   planned scanning integration.
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/app/lib/cloudStorage";
import { UploadFormSchema, parseBody } from "@/app/api/schemas";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File "${file.name}" exceeds the maximum allowed size of 500 MB`;
  }
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `File "${file.name}" has an unsupported format. Allowed: MP4, MOV, AVI, MKV`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    const parsed = parseBody(UploadFormSchema, { files });
    if (!parsed.ok) return NextResponse.json(parsed.result, { status: 400 });

    // Validate every file before touching storage
    const validationErrors: string[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) validationErrors.push(err);
    }
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join("; ") },
        { status: 400 }
      );
    }

    // Upload all files to cloud storage
    const results = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return uploadFile(buffer, file.name, file.type || "application/octet-stream");
      })
    );

    // Return the first jobId as the primary reference (for single-file flows)
    const primaryJobId = results[0].jobId;

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      jobId: primaryJobId,
      files: results.map((r) => ({
        name: r.filename,
        size: r.size,
        type: r.contentType,
        jobId: r.jobId,
        objectKey: r.objectKey,
        url: r.url,
      })),
    });
  } catch (error: unknown) {
    // Differentiate configuration errors from runtime errors
    if (error instanceof Error && error.message.startsWith("Missing required environment variable")) {
      console.error("Upload config error:", error.message);
      return NextResponse.json(
        { error: "Cloud storage is not configured. Contact support." },
        { status: 503 }
      );
    }

    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
