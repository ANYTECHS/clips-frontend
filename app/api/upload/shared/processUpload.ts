/**
 * Shared upload validation and ingest pipeline.
 *
 * Extracted so the whole-file route (`/api/upload`) and the chunked route
 * (`/api/upload/chunk/complete`, #881) run the *same* validation, virus scan
 * and storage flow. A second copy of this logic would be a place for the two
 * paths to drift, and the thing that would drift is the security scan.
 */

import {
  uploadToQuarantine,
  moveFromQuarantine,
  deleteFile,
} from "@/app/lib/cloudStorage";
import { scanFile, VirusScanError, DegradedScanResult } from "@/app/lib/virusScan";
import { MAX_UPLOAD_SIZE_BYTES } from "@/app/lib/constants";
import { logger } from "@/app/lib/logger";

/** MIME types accepted by the uploader. */
export const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

/** File extensions accepted by the uploader. */
export const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv"];

/** Number of leading bytes inspected for a video signature. */
const MAGIC_BYTE_WINDOW = 12;

/**
 * Result of a magic byte inspection.
 *
 * Carries enough detail for security logging without leaking raw bytes.
 */
export interface MagicByteResult {
  valid: boolean;
  /** Detected format, or null when no known signature matched. */
  detectedFormat: "mp4" | "mov" | "avi" | "mkv" | "webm" | null;
  error: string | null;
}

/**
 * Inspect the leading bytes of `buffer` and return a structured result.
 *
 * All signature checks use exact byte-offset comparisons, not substring
 * matching, so a crafted file cannot trick the check by embedding the
 * target ASCII sequence at the wrong position.
 *
 * Supported signatures:
 *  - MP4  : bytes 4–7 === 0x66 0x74 0x79 0x70 ("ftyp")
 *  - MOV  : bytes 4–7 === "ftyp" AND bytes 8–11 contain "qt  " or "moov"/"wide"
 *           (we detect both as "ftyp"-family and distinguish by brand)
 *  - AVI  : bytes 0–3 === "RIFF" AND bytes 8–11 === "AVI "
 *  - MKV  : bytes 0–3 === 0x1A 0x45 0xDF 0xA3 (EBML)
 *  - WebM : same EBML header — WebM is a subset of Matroska
 */
export function inspectMagicBytes(buffer: Buffer): MagicByteResult {
  if (buffer.length < MAGIC_BYTE_WINDOW) {
    return {
      valid: false,
      detectedFormat: null,
      error: "File is too small to be a valid video file",
    };
  }

  // MP4 / MOV — ISO Base Media (ftyp box at byte offset 4)
  // Check exact bytes rather than ASCII string scan to prevent bypass.
  const isFtypBox =
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70;   // p

  if (isFtypBox) {
    // Distinguish MOV (QuickTime brand "qt  ") from generic MP4
    const brand =
      buffer[8] === 0x71 && buffer[9] === 0x74 && buffer[10] === 0x20 && buffer[11] === 0x20;
    return { valid: true, detectedFormat: brand ? "mov" : "mp4", error: null };
  }

  // AVI — RIFF container with "AVI " sub-type at offset 8
  const isRiff =
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46;   // F
  const isAviSubtype =
    buffer[8] === 0x41 && // A
    buffer[9] === 0x56 && // V
    buffer[10] === 0x49 && // I
    buffer[11] === 0x20;   // (space)

  if (isRiff && isAviSubtype) {
    return { valid: true, detectedFormat: "avi", error: null };
  }

  // MKV / WebM — EBML magic bytes
  const isEbml =
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3;

  if (isEbml) {
    return { valid: true, detectedFormat: "mkv", error: null };
  }

  return {
    valid: false,
    detectedFormat: null,
    error: "File content does not match declared type",
  };
}

/**
 * Validates file magic bytes against known video signatures.
 *
 * Reads the first bytes of the buffer to detect the actual file type,
 * preventing malware masquerading as a video via extension or MIME spoofing.
 *
 * @param buffer - File buffer to inspect.
 * @param filename - Optional filename used for security audit logging.
 * @returns Error message if the magic bytes do not match, null if valid.
 */
export function validateMagicBytes(buffer: Buffer, filename?: string): string | null {
  const result = inspectMagicBytes(buffer);

  if (result.valid) {
    logger.info(
      `[Upload] Magic byte validation passed${filename ? ` for "${filename}"` : ""}: detected format=${result.detectedFormat}`,
    );
    return null;
  }

  logger.warn(
    `[Upload] Magic byte validation failed${filename ? ` for "${filename}"` : ""}: ${result.error}`,
  );
  return result.error;
}

/**
 * Validates the declared name, size and type of an upload.
 *
 * Runs before any bytes are stored, so an oversized or unsupported file is
 * rejected without paying for the transfer. The chunked flow calls this at
 * session creation for exactly that reason.
 *
 * @returns Error message, or null when the metadata is acceptable.
 */
export function validateUploadMetadata(meta: {
  name: string;
  size: number;
  type?: string;
}): string | null {
  if (!Number.isFinite(meta.size) || meta.size <= 0) {
    return `File "${meta.name}" has an invalid size`;
  }
  if (meta.size > MAX_UPLOAD_SIZE_BYTES) {
    return `File "${meta.name}" exceeds the maximum allowed size of 500 MB`;
  }
  const ext = "." + (meta.name.split(".").pop()?.toLowerCase() ?? "");
  if (!ALLOWED_TYPES.includes(meta.type ?? "") && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `File "${meta.name}" has an unsupported format. Allowed: MP4, MOV, AVI, MKV`;
  }
  return null;
}

/** A file that has passed validation, scanning, and been stored. */
export interface ProcessedUpload {
  name: string;
  size: number;
  type: string;
  jobId: string;
  objectKey: string;
  url: string;
  /** True when the virus scan service was unavailable and the file was allowed
   *  through in degraded mode (VIRUS_SCAN_ALLOW_ON_FAILURE=true). Consumers
   *  should persist this flag on the job record so it can be audited later. */
  scanDegraded?: boolean;
  /** Human-readable reason for the degraded scan result, when applicable. */
  scanDegradedReason?: string;
}

/**
 * Validate, scan and store one uploaded file buffer.
 *
 * The flow is quarantine → scan → release, so unscanned bytes never sit under
 * the public prefix. Anything that fails the scan — including a scan that
 * errors or times out — is deleted from quarantine and rejected: an
 * unverifiable file is treated exactly like an infected one.
 *
 * @throws When magic bytes do not match, or the file fails or cannot complete
 * a security scan.
 */
export async function processUploadedBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<ProcessedUpload> {
  const magicBytesError = validateMagicBytes(buffer, filename);
  if (magicBytesError) {
    throw new Error(magicBytesError);
  }

  // Step 1: Upload to quarantine
  const quarantine = await uploadToQuarantine(buffer, filename, contentType);
  logger.info(
    `[Upload] File quarantined: ${quarantine.jobId} at ${quarantine.quarantineKey}`,
  );

  // Step 2: Scan the file
  let scanResult;
  try {
    scanResult = await scanFile(buffer);
    logger.info(
      `[Upload] Scan complete for ${quarantine.jobId}: clean=${scanResult.isClean}, provider=${scanResult.provider}` +
        ((scanResult as DegradedScanResult).degraded ? " (DEGRADED)" : ""),
    );
  } catch (scanErr) {
    // Scan failed or timed out — treat as quarantined, not clean.
    const error =
      scanErr instanceof VirusScanError ? scanErr : new Error(String(scanErr));
    logger.error(`[Upload] Scan error for ${quarantine.jobId}: ${error.message}`);

    await deleteFile(quarantine.quarantineKey).catch((deleteErr) => {
      logger.error(`[Upload] Failed to delete quarantined file: ${deleteErr}`);
    });

    throw new Error(`File failed security scan (${error.message})`);
  }

  // Step 3: Reject anything the scanner flagged
  if (!scanResult.isClean) {
    await deleteFile(quarantine.quarantineKey).catch((deleteErr) => {
      logger.error(`[Upload] Failed to delete infected file: ${deleteErr}`);
    });
    throw new Error("File failed security scan");
  }

  // Step 4: Move from quarantine to the final location
  const finalResult = await moveFromQuarantine(
    quarantine.jobId,
    quarantine.filename,
  );
  logger.info(`[Upload] File released from quarantine: ${quarantine.jobId}`);

  return {
    name: finalResult.filename,
    size: buffer.length,
    type: contentType,
    jobId: finalResult.jobId,
    objectKey: finalResult.objectKey,
    url: finalResult.url,
    ...((scanResult as DegradedScanResult).degraded
      ? {
          scanDegraded: true,
          scanDegradedReason: (scanResult as DegradedScanResult).degradedReason,
        }
      : {}),
  };
}
