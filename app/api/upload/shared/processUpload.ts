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
import { scanFile, VirusScanError } from "@/app/lib/virusScan";
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
 * Validates file magic bytes against known video signatures.
 *
 * Reads the first bytes of the buffer to detect the actual file type,
 * preventing malware masquerading as a video via extension or MIME spoofing.
 *
 * @param buffer - File buffer to inspect.
 * @returns Error message if the magic bytes do not match, null if valid.
 */
export function validateMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < MAGIC_BYTE_WINDOW) {
    return "File is too small to be a valid video file";
  }

  const header = buffer.subarray(0, MAGIC_BYTE_WINDOW);
  const headerStr = header.toString("ascii", 0, MAGIC_BYTE_WINDOW);

  // MP4/MOV: "ftyp" at offset 4, with a brand like "isom", "mp42" or "qt  ".
  const isFtyp = headerStr.includes("ftyp");
  // AVI: "RIFF" followed by "AVI " at offset 8.
  const isAvi = headerStr.startsWith("RIFF") && headerStr.includes("AVI");
  // MKV: EBML header \x1A\x45\xDF\xA3.
  const isMkv =
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3;

  return isFtyp || isAvi || isMkv
    ? null
    : "File content does not match declared type";
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
  const magicBytesError = validateMagicBytes(buffer);
  if (magicBytesError) {
    logger.error(
      `[Upload] Magic bytes validation failed for ${filename}: ${magicBytesError}`,
    );
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
      `[Upload] Scan complete for ${quarantine.jobId}: clean=${scanResult.isClean}, provider=${scanResult.provider}`,
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
  };
}
