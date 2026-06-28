/**
 * /api/upload/route.ts — Issue #442
 *
 * Real cloud-storage upload endpoint with virus scanning.
 *
 * Files are validated, scanned for malware, then stored in the configured
 * S3-compatible bucket (AWS S3, Cloudflare R2, or GCS S3 interop).
 *
 * Upload flow:
 * 1. File validation (size, type, extension)
 * 2. Upload to quarantine prefix (uploads/quarantine/)
 * 3. Virus scan (ClamAV / VirusTotal / Cloudmersive)
 * 4a. If clean: Move from quarantine to uploads/ prefix
 * 4b. If infected: Delete from quarantine, return 400 error
 * 5. Return presigned URL or public URL
 *
 * File size limit: 500 MB (hard-rejected before any storage call).
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
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { uploadToQuarantine, moveFromQuarantine, deleteFile } from "@/app/lib/cloudStorage";
import { scanFile, VirusScanError, getScanConfig } from "@/app/lib/virusScan";
import { checkCsrf } from "@/app/lib/csrf";
import { jobStore } from "@/app/api/jobs/shared/jobStore";
import { dispatchJob } from "@/app/lib/aiBackend";
import { applyRateLimit } from "@/app/lib/serverRateLimit";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_FILES_PER_REQUEST = 10;
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
    const rateLimited = applyRateLimit(request, { limit: 20, windowMs: 60_000 });
    if (rateLimited) return rateLimited;

    const csrfError = checkCsrf(request);
    if (csrfError) return csrfError;

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
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
      return NextResponse.json(
        { error: validationErrors.join("; ") },
        { status: 400 }
      );
    }

    const scanConfig = getScanConfig();
    console.log(`[Upload] Scanning enabled: ${scanConfig.enabled}, Provider: ${scanConfig.provider}`);

    // Upload all files to quarantine and scan them
    const results = await Promise.all(
      files.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Step 1: Upload to quarantine
        const quarantine = await uploadToQuarantine(buffer, file.name, file.type || "application/octet-stream");
        console.log(`[Upload] File quarantined: ${quarantine.jobId} at ${quarantine.quarantineKey}`);

        // Step 2: Scan the file
        let scanResult;
        try {
          scanResult = await scanFile(buffer);
          console.log(`[Upload] Scan complete for ${quarantine.jobId}: clean=${scanResult.isClean}, provider=${scanResult.provider}`);
        } catch (scanErr) {
          // Scan failed or timed out - treat as quarantined (not clean)
          const error = scanErr instanceof VirusScanError ? scanErr : new Error(String(scanErr));
          console.error(`[Upload] Scan error for ${quarantine.jobId}: ${error.message}`);

          // Delete the quarantined file since we can't verify it's safe
          try {
            await deleteFile(quarantine.quarantineKey);
            console.log(`[Upload] Quarantined file deleted: ${quarantine.quarantineKey}`);
          } catch (deleteErr) {
            console.error(`[Upload] Failed to delete quarantined file: ${deleteErr}`);
          }

          throw new Error(`File failed security scan (${error.message})`);
        }

        // Step 3: Process based on scan result
        if (!scanResult.isClean) {
          // File is infected - delete it
          try {
            await deleteFile(quarantine.quarantineKey);
            console.log(`[Upload] Infected file deleted: ${quarantine.quarantineKey}`);
          } catch (deleteErr) {
            console.error(`[Upload] Failed to delete infected file: ${deleteErr}`);
          }
          throw new Error("File failed security scan");
        }

        // Step 4: Move from quarantine to final location
        const finalResult = await moveFromQuarantine(quarantine.jobId, quarantine.filename);
        console.log(`[Upload] File released from quarantine: ${quarantine.jobId}`);

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

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${files.length} file(s)`,
      jobId: primaryJobId,
      files: results,
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

    // Virus scan errors
    if (error instanceof Error && error.message.includes("security scan")) {
      console.error("Upload security error:", error.message);
      return NextResponse.json(
        { error: "File failed security scan" },
        { status: 400 }
      );
    }

    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}
