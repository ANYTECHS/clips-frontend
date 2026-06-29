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
import { uploadToQuarantine, moveFromQuarantine, deleteFile } from "@/app/lib/cloudStorage";
import { scanFile, VirusScanError, getScanConfig } from "@/app/lib/virusScan";
import { checkCsrf } from "@/app/lib/csrf";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { dispatchJob } from "@/app/lib/aiBackend";
import { MAX_UPLOAD_SIZE_BYTES } from "@/app/lib/constants";
import { logger } from "@/app/lib/logger";

export { MAX_UPLOAD_SIZE_BYTES };
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];

/**
 * Validates file magic bytes against known video signatures.
 * Reads first 12 bytes of buffer to detect actual file type.
 * 
 * @param buffer - File buffer to inspect
 * @param declaredType - Declared MIME type from upload
 * @returns Error message if magic bytes don't match, null if valid
 */
function validateMagicBytes(buffer: Buffer, declaredType: string): string | null {
  if (buffer.length < 12) {
    return "File is too small to be a valid video file";
  }

  const header = buffer.subarray(0, 12);
  const headerStr = header.toString('ascii', 0, Math.min(12, buffer.length));

  // MP4/MOV: starts with "ftyp" at offset 4
  // MP4: ftyp... with brand like "isom", "mp42", etc.
  // MOV: ftyp... with brand "qt  "
  const isFtyp = headerStr.includes('ftyp');
  
  // AVI: starts with "RIFF" followed by "AVI " at offset 8
  const isAvi = headerStr.startsWith('RIFF') && headerStr.includes('AVI');
  
  // MKV: starts with EBML header \x1A\x45\xDF\xA3
  const isMkv = header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3;

  const isValidVideo = isFtyp || isAvi || isMkv;

  if (!isValidVideo) {
    return "File content does not match declared type";
  }

  return null;
}

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
    const rateLimited = applyRateLimit(request, { limit: 20, windowMs: 60_000 });
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
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate magic bytes before any storage operations
        const magicBytesError = validateMagicBytes(buffer, file.type || "application/octet-stream");
        if (magicBytesError) {
          logger.error(`[Upload] Magic bytes validation failed for ${file.name}: ${magicBytesError}`);
          throw new Error(magicBytesError);
        }

        // Step 1: Upload to quarantine
        const quarantine = await uploadToQuarantine(
          buffer,
          file.name,
          file.type || "application/octet-stream"
        );
        logger.info(`[Upload] File quarantined: ${quarantine.jobId} at ${quarantine.quarantineKey}`);

        // Step 2: Scan the file
        let scanResult;
        try {
          scanResult = await scanFile(buffer);
          logger.info(
            `[Upload] Scan complete for ${quarantine.jobId}: clean=${scanResult.isClean}, provider=${scanResult.provider}`
          );
        } catch (scanErr) {
          // Scan failed or timed out - treat as quarantined (not clean)
          const error = scanErr instanceof VirusScanError ? scanErr : new Error(String(scanErr));
          logger.error(`[Upload] Scan error for ${quarantine.jobId}: ${error.message}`);

          // Delete the quarantined file since we can't verify it's safe
          try {
            await deleteFile(quarantine.quarantineKey);
            logger.info(`[Upload] Quarantined file deleted: ${quarantine.quarantineKey}`);
          } catch (deleteErr) {
            logger.error(`[Upload] Failed to delete quarantined file: ${deleteErr}`);
          }

          throw new Error(`File failed security scan (${error.message})`);
        }

        // Step 3: Process based on scan result
        if (!scanResult.isClean) {
          // File is infected - delete it
          try {
            await deleteFile(quarantine.quarantineKey);
            logger.info(`[Upload] Infected file deleted: ${quarantine.quarantineKey}`);
          } catch (deleteErr) {
            logger.error(`[Upload] Failed to delete infected file: ${deleteErr}`);
          }
          throw new Error("File failed security scan");
        }

        // Step 4: Move from quarantine to final location
        const finalResult = await moveFromQuarantine(quarantine.jobId, quarantine.filename);
        logger.info(`[Upload] File released from quarantine: ${quarantine.jobId}`);

        return {
          name: finalResult.filename,
          size: buffer.length,
          type: file.type || "application/octet-stream",
          jobId: finalResult.jobId,
          objectKey: finalResult.objectKey,
          url: finalResult.url,
        };
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

