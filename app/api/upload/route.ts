/**
 * /api/upload/route.ts — Issue #442
 *
 * Real cloud-storage upload endpoint with virus scanning.
 *
 * Files are validated, scanned for malware, then stored in the configured
 * S3-compatible bucket (AWS S3, Cloudflare R2, or GCS S3 interop).
 *
 * Upload flow:
 * 1. File validation (size, type, extension, magic bytes)
 * 2. Upload to quarantine prefix (uploads/quarantine/)
 * 3. Virus scan (ClamAV / VirusTotal / Cloudmersive)
 * 4a. If clean: Move from quarantine to uploads/ prefix
 * 4b. If infected: Delete from quarantine, return 400 error
 * 5. Return presigned URL or public URL
 *
 * File size limit: 500 MB (hard-rejected before any storage call).
 *
 * Magic bytes verification:
 * - Reads first 12 bytes of file buffer to verify actual file content
 * - Checks against known video signatures: MP4 (ftyp), MOV (ftyp/wide), AVI (RIFF), MKV (\x1A\x45\xDF\xA3)
 * - Prevents malware masquerading as video files via extension/MIME spoofing
 *
 * Environment variables required (see app/lib/cloudStorage.ts for full list):
 *   CLOUD_STORAGE_BUCKET, CLOUD_STORAGE_REGION, AWS_ACCESS_KEY_ID,
 *   AWS_SECRET_ACCESS_KEY
 *
 * Optional:
 *   CLOUD_STORAGE_ENDPOINT        — for R2 / GCS S3 interop
 *   CLOUD_STORAGE_KEY_PREFIX      — object key prefix (default: "uploads/")
 *   VIRUS_SCAN_PROVIDER           — "clamav" | "virustotal" | "cloudmersive" | "disabled" (default: "clamav")
 *   VIRUS_SCAN_TIMEOUT            — Timeout in ms (default: 30000)
 *   VIRUS_SCAN_QUARANTINE_PREFIX  — Quarantine prefix (default: "uploads/quarantine/")
 *   VIRUS_SCAN_ENABLED            — "true" | "false" (default: "true" in prod)
 *   CLAMAV_API_URL                — ClamAV endpoint (for clamav provider)
 *   VIRUSTOTAL_API_KEY            — VirusTotal API key
 *   CLOUDMERSIVE_API_KEY          — Cloudmersive API key
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { getScanConfig } from "@/app/lib/virusScan";
import {
  ALLOWED_TYPES,
  ALLOWED_EXTENSIONS,
  processUploadedBuffer,
  validateMagicBytes,
} from "@/app/api/upload/shared/processUpload";
import { checkCsrf } from "@/app/lib/csrf";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { dispatchJob } from "@/app/lib/aiBackend";
import { MAX_UPLOAD_SIZE_BYTES, MAX_FILES_PER_REQUEST } from "@/app/lib/constants";
import { applyRateLimit } from "@/app/lib/serverRateLimit";
import { getEndpointRateLimit } from "@/app/lib/endpointRateLimits";
import { logger } from "@/app/lib/logger";

export { MAX_UPLOAD_SIZE_BYTES, MAX_FILES_PER_REQUEST };
export { ALLOWED_TYPES, ALLOWED_EXTENSIONS, validateMagicBytes };

function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
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
    const rateLimited = await applyRateLimit(request, getEndpointRateLimit("/api/upload"));
    if (rateLimited) return rateLimited;

    const csrfError = checkCsrf(request);
    if (csrfError) return csrfError;

    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      const body: ApiResponse<null> = { data: null, error: "Unauthorized" };
      return NextResponse.json(body, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      const body: ApiResponse<null> = {
        data: null,
        error: "No files provided",
        code: "NO_FILES",
      };
      return NextResponse.json(body, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_FILES_PER_REQUEST} files per request.` },
        { status: 400 }
      );
    }

    // Validate every file before touching storage
    const validationErrors: string[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) validationErrors.push(err);
    }

    if (validationErrors.length > 0) {
      const body: ApiResponse<null> = {
        data: null,
        error: validationErrors.join("; "),
        code: "VALIDATION_FAILED",
      };
      return NextResponse.json(body, { status: 400 });
    }

    const scanConfig = getScanConfig();
    logger.info(`[Upload] Scanning enabled: ${scanConfig.enabled}, Provider: ${scanConfig.provider}`);

    // Upload all files to quarantine and scan them
    const results = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return processUploadedBuffer(
          buffer,
          file.name,
          file.type || "application/octet-stream",
        );
      })
    );

    // Return the first jobId as the primary reference (for single-file flows)
    const primaryJobId = results[0].jobId;

    // Persist jobs to the store and dispatch each one to the AI backend.
    const callbackBase =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    await Promise.all(
      results.map(async (result) => {
        // Register the job in "queued" state. The AI backend transitions it to
        // "processing" then "complete"/"error" via the callback route.
        jobStore.set(result.jobId, {
          id: result.jobId,
          userId,
          status: "queued",
          progress: 0,
          momentsFound: 0,
          estimatedSecondsRemaining: 0,
          createdAt: Date.now(),
          // Persist enough metadata for job restarts.
          ...({ objectKey: result.objectKey } as object),
          ...({ contentType: result.type } as object),
          ...({ filename: result.name } as object),
        });

        await dispatchJob({
          jobId: result.jobId,
          userId,
          objectKey: result.objectKey,
          contentType: result.type,
          filename: result.name,
          callbackUrl: `${callbackBase}/api/jobs/${result.jobId}/callback`,
        });
      })
    );

    const body: ApiResponse<{
      success: true;
      message: string;
      jobId: string;
      files: typeof results;
    }> = {
      data: {
        success: true,
        message: `Successfully uploaded ${files.length} file(s)`,
        jobId: primaryJobId,
        files: results,
      },
      error: null,
    };

    return NextResponse.json(body);
  } catch (error: unknown) {
    // Differentiate configuration errors from runtime errors
    if (
      error instanceof Error &&
      error.message.startsWith("Missing required environment variable")
    ) {
      logger.error("Upload config error:", error.message);
      const body: ApiResponse<null> = {
        data: null,
        error: "Cloud storage is not configured. Contact support.",
        code: "STORAGE_NOT_CONFIGURED",
      };
      return NextResponse.json(body, { status: 503 });
    }

    // Virus scan errors
    if (error instanceof Error && error.message.includes("security scan")) {
      logger.error("Upload security error:", error.message);
      const body: ApiResponse<null> = {
        data: null,
        error: "File failed security scan",
        code: "SECURITY_SCAN_FAILED",
      };
      return NextResponse.json(body, { status: 400 });
    }

    logger.error("Upload error:", error);
    const body: ApiResponse<null> = {
      data: null,
      error: "Internal server error during upload",
      code: "UPLOAD_INTERNAL_ERROR",
    };
    return NextResponse.json(body, { status: 500 });
  }
}

