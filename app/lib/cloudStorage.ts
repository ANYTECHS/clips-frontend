/**
 * cloudStorage.ts — Issue #442
 *
 * Thin abstraction over S3-compatible cloud storage (AWS S3, GCS via S3
 * interop, or Cloudflare R2).  The active backend is determined entirely by
 * environment variables so no code changes are needed to switch providers.
 *
 * Required env vars:
 * CLOUD_STORAGE_PROVIDER   — "s3" | "r2" | "gcs"  (default: "s3")
 * CLOUD_STORAGE_BUCKET     — bucket name
 * CLOUD_STORAGE_REGION     — region (e.g. "us-east-1"; R2 uses "auto")
 * CLOUD_STORAGE_ENDPOINT   — custom endpoint URL (required for R2 / GCS S3)
 * AWS_ACCESS_KEY_ID        — access key / account ID
 * AWS_SECRET_ACCESS_KEY    — secret key / API token
 *
 * Optional:
 * CLOUD_STORAGE_KEY_PREFIX — prefix prepended to all object keys (default: "uploads/")
 */

import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { withRetry } from "./retryUtils";

// ─── Concurrency Limited Execution Utility ───────────────────────────────────

/**
 * Execute tasks in parallel with a maximum concurrency limit.
 *
 * @template T - The resolution type of the task promises.
 * @param tasks - Array of functions that return promises.
 * @param concurrency - Maximum number of concurrent tasks to execute.
 * @returns Array of results in order of tasks.
 */
async function parallelWithLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  const worker = async () => {
    while (index < tasks.length) {
      const currentIndex = index++;
      const task = tasks[currentIndex];
      results[currentIndex] = await task();
    }
  };

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);

  return results;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Ensures an environment variable exists, throwing an error if it is missing.
 *
 * @param name - The name of the target environment variable.
 * @returns The retrieved environment variable value string.
 * @throws {Error} Thrown if the target environment variable is empty or undefined.
 */
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

/**
 * Initializes and builds an S3Client instance configured via active environment variables.
 *
 * @returns An authenticated S3Client service instance.
 */
function buildS3Client(): S3Client {
  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT;
  return new S3Client({
    region: process.env.CLOUD_STORAGE_REGION ?? "us-east-1",
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

const BUCKET = () => requireEnv("CLOUD_STORAGE_BUCKET");
const KEY_PREFIX = process.env.CLOUD_STORAGE_KEY_PREFIX ?? "uploads/";
const QUARANTINE_PREFIX = process.env.VIRUS_SCAN_QUARANTINE_PREFIX ?? "uploads/quarantine/";

// Multipart threshold: files larger than 50 MB use multipart upload.
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB
// Part size for multipart: 10 MB minimum per S3 spec.
const PART_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Data metadata mapping standard attributes describing a finalized storage object entry.
 */
export interface UploadResult {
  /** Stable job ID tied to this specific upload */
  jobId: string;
  /** Full object key in the bucket */
  objectKey: string;
  /** Public or pre-signed URL (if bucket is public) */
  url: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  contentType: string;
}

// ─── Single-part upload (<= MULTIPART_THRESHOLD) ─────────────────────────────

/**
 * Performs an atomic single-part PutObject upload directly into an S3 target.
 *
 * @param client - The active authenticated S3Client service instances instance.
 * @param bucket - Target destination storage bucket path name.
 * @param key - The calculated path filename key destination identifier.
 * @param buffer - File data memory payload array.
 * @param contentType - Standard application/mime target descriptor mapping.
 * @returns Resolves when the upload command processes cleanly.
 */
async function uploadSinglePart(
  client: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    }),
  );
}

// ─── Multipart upload (> MULTIPART_THRESHOLD) ─────────────────────────────────

const MAX_CONCURRENT_PARTS = 5;

/**
 * Performs a chunked concurrent multipart file streaming configuration upload sequence.
 *
 * @param client - The active authenticated S3Client service instances instance.
 * @param bucket - Target destination storage bucket path name.
 * @param key - The calculated path filename key destination identifier.
 * @param buffer - Large file data memory payload array.
 * @param contentType - Standard application/mime target descriptor mapping.
 * @returns Resolves upon compiling and verifying full block signatures cleanly.
 * @throws {Error} If multipart creation returns invalid tracking IDs or part uploads fail.
 */
async function uploadMultipart(
  client: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  );

  if (!UploadId) throw new Error("Failed to create multipart upload");

  let parts: { ETag: string; PartNumber: number }[] = [];

  try {
    const partCount = Math.ceil(buffer.length / PART_SIZE);

    const uploadTasks: Array<() => Promise<{ ETag: string; PartNumber: number }>> = [];
    for (let i = 0; i < partCount; i++) {
      const partNumber = i + 1;
      const offset = i * PART_SIZE;
      const chunk = buffer.slice(offset, offset + PART_SIZE);
      
      uploadTasks.push(async () => {
        const { ETag } = await withRetry(
          () =>
            client.send(
              new UploadPartCommand({
                Bucket: bucket,
                Key: key,
                UploadId,
                PartNumber: partNumber,
                Body: chunk,
                ContentLength: chunk.length,
              }),
            ),
          { maxAttempts: 3 },
        );
        if (!ETag) throw new Error(`Missing ETag for part ${partNumber}`);
        return { ETag, PartNumber: partNumber };
      });
    }

    parts = await parallelWithLimit(uploadTasks, MAX_CONCURRENT_PARTS);

    parts.sort((a, b) => a.PartNumber - b.PartNumber);

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (err) {
    await client
      .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId }))
      .catch(() => {});
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to cloud storage.
 *
 * - Files ≤ 50 MB use a single PutObject request.
 * - Files > 50 MB use multipart upload (10 MB parts).
 * - Returns an UploadResult with a stable jobId.
 *
 * @param buffer - File data memory payload array.
 * @param filename - String representation naming context.
 * @param contentType - Standard application/mime target descriptor mapping.
 * @returns Resolves with metadata mapping summarizing successful submission.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<UploadResult> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const jobId = `job_${randomUUID().replace(/-/g, "")}`;
  const ext = filename.split(".").pop() ?? "bin";
  const objectKey = `${KEY_PREFIX}${jobId}.${ext}`;

  if (buffer.length > MULTIPART_THRESHOLD) {
    await uploadMultipart(client, bucket, objectKey, buffer, contentType);
  } else {
    await uploadSinglePart(client, bucket, objectKey, buffer, contentType);
  }

  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT;
  const region = process.env.CLOUD_STORAGE_REGION ?? "us-east-1";
  const url = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${objectKey}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;

  return { jobId, objectKey, url, filename, size: buffer.length, contentType };
}

/**
 * Upload a file buffer to the quarantine prefix (for scanning).
 *
 * Similar to uploadFile but stores in VIRUS_SCAN_QUARANTINE_PREFIX instead.
 * Returns the quarantine object key and jobId.
 *
 * @param buffer - File data memory payload array.
 * @param filename - String representation naming context.
 * @param contentType - Standard application/mime target descriptor mapping.
 * @returns Metadata object holding job records and specific safety references.
 */
export async function uploadToQuarantine(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ jobId: string; quarantineKey: string; filename: string }> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const jobId = `job_${randomUUID().replace(/-/g, "")}`;
  const ext = filename.split(".").pop() ?? "bin";
  const quarantineKey = `${QUARANTINE_PREFIX}${jobId}.${ext}`;

  if (buffer.length > MULTIPART_THRESHOLD) {
    await uploadMultipart(client, bucket, quarantineKey, buffer, contentType);
  } else {
    await uploadSinglePart(client, bucket, quarantineKey, buffer, contentType);
  }

  return { jobId, quarantineKey, filename };
}

/**
 * Move a file from quarantine to the final uploads location.
 *
 * After a file passes the virus scan, it should be moved from the quarantine
 * prefix to the regular uploads prefix. This is implemented as a copy + delete
 * since S3 doesn't have a true move operation.
 *
 * @param jobId - Job ID of the file to move.
 * @param filename - Original filename (used to determine extension).
 * @returns UploadResult with the final object key and URL.
 */
export async function moveFromQuarantine(jobId: string, filename: string): Promise<UploadResult> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const ext = filename.split(".").pop() ?? "bin";
  const quarantineKey = `${QUARANTINE_PREFIX}${jobId}.${ext}`;
  const finalKey = `${KEY_PREFIX}${jobId}.${ext}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${quarantineKey}`,
      Key: finalKey,
    }),
  );

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: quarantineKey,
    }),
  );

  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT;
  const region = process.env.CLOUD_STORAGE_REGION ?? "us-east-1";
  const url = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}/${finalKey}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${finalKey}`;

  return {
    jobId,
    objectKey: finalKey,
    url,
    filename,
    size: 0,
    contentType: "application/octet-stream",
  };
}

/**
 * Delete a file from S3 (used for infected files).
 *
 * @param objectKey - Full object key to delete (including prefix).
 * @returns Resolves when the file deletion confirmation completes.
 */
export async function deleteFile(objectKey: string): Promise<void> {
  const client = buildS3Client();
  const bucket = BUCKET();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  );
}
