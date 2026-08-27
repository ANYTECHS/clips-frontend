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
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { withRetry } from "./retryUtils";
import { getCircuitBreaker } from "./circuitBreaker";
import { logger } from "./logger";

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
/** Prefix used for AI-transformed output files, kept separate from raw uploads. */
export const TRANSFORMS_PREFIX = "transforms/";
/** Prefix used for transcoded clip exports (multi-format / aspect-ratio outputs). */
export const EXPORTS_PREFIX = "exports/";

/**
 * Build the S3 object key for a transcoded export.
 */
export function buildExportObjectKey(
  clipId: string,
  format: string,
  aspectRatio: string,
  quality: string,
  exportId: string,
): string {
  const safeRatio = aspectRatio.replace(":", "x");
  return `${EXPORTS_PREFIX}${clipId}/${exportId}_${safeRatio}_${quality}.${format}`;
}

/**
 * Build a public or endpoint-based URL for an object key without presigning.
 */
export function buildObjectUrl(objectKey: string): string {
  const bucket = process.env.CLOUD_STORAGE_BUCKET;
  const endpoint = process.env.CLOUD_STORAGE_ENDPOINT;
  const region = process.env.CLOUD_STORAGE_REGION ?? "us-east-1";

  if (!bucket) {
    return `https://storage.example.com/${objectKey}`;
  }

  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${objectKey}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;
}

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

// ─── S3 error classification ──────────────────────────────────────────────────

/**
 * Returns true for S3 errors that should NOT be retried.
 * Credentials, bucket-not-found and permission errors are permanent failures.
 */
function isNonRetryableS3Error(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = (err as Error & { name?: string }).name ?? "";
  const code = (err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } }).Code ?? "";
  const httpStatus =
    (err as Error & { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode ?? 0;
  return (
    name === "NoSuchBucket" ||
    name === "AccessDenied" ||
    code === "NoSuchBucket" ||
    code === "AccessDenied" ||
    code === "InvalidAccessKeyId" ||
    code === "SignatureDoesNotMatch" ||
    httpStatus === 403 ||
    httpStatus === 404
  );
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
  await withRetry(
    () =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ContentLength: buffer.length,
        }),
      ),
    {
      maxAttempts: 3,
      baseDelayMs: 300,
      maxDelayMs: 5_000,
      shouldAbort: isNonRetryableS3Error,
    },
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
          { maxAttempts: 3, shouldAbort: isNonRetryableS3Error },
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
  const cb = getCircuitBreaker("cloudStorage");
  return cb.executeOrThrow(async () => {
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
  });
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
  const cb = getCircuitBreaker("cloudStorage");
  return cb.executeOrThrow(async () => {
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
  });
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
  const cb = getCircuitBreaker("cloudStorage");
  return cb.executeOrThrow(async () => {
    const client = buildS3Client();
    const bucket = BUCKET();

    const ext = filename.split(".").pop() ?? "bin";
    const quarantineKey = `${QUARANTINE_PREFIX}${jobId}.${ext}`;
    const finalKey = `${KEY_PREFIX}${jobId}.${ext}`;

    await withRetry(
      () =>
        client.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${quarantineKey}`,
            Key: finalKey,
          }),
        ),
      { maxAttempts: 3, baseDelayMs: 300, shouldAbort: isNonRetryableS3Error },
    );

    await withRetry(
      () =>
        client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: quarantineKey }),
        ),
      { maxAttempts: 3, baseDelayMs: 300, shouldAbort: isNonRetryableS3Error },
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
  });
}

/**
 * Delete a file from S3 (used for infected files).
 *
 * @param objectKey - Full object key to delete (including prefix).
 * @returns Resolves when the file deletion confirmation completes.
 */
export async function deleteFile(objectKey: string): Promise<void> {
  const cb = getCircuitBreaker("cloudStorage");
  await cb.execute(
    () =>
      withRetry(
        async () => {
          const client = buildS3Client();
          const bucket = BUCKET();
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
        },
        { maxAttempts: 3, baseDelayMs: 300, shouldAbort: isNonRetryableS3Error },
      ),
    () => {
      // Storage is down — log the orphaned key so ops can clean up manually.
      // Don't throw: callers (virus scan cleanup) already wrap this in .catch().
      logger.error(
        `[cloudStorage] deleteFile: circuit open, could not delete orphaned key: ${objectKey}`
      );
    },
  );
}

/**
 * Store an AI-transformed video result under the `transforms/` prefix.
 *
 * Mirrors uploadFile but uses TRANSFORMS_PREFIX so transform outputs are
 * stored separately from raw user uploads and can be managed independently
 * (e.g. different lifecycle policies, cost attribution).
 *
 * @param buffer - Transformed video data.
 * @param jobId  - The transform job id (used as the object key stem).
 * @param contentType - MIME type of the transformed file.
 * @returns UploadResult scoped to the transforms/ prefix.
 */
export async function uploadTransformResult(
  buffer: Buffer,
  jobId: string,
  contentType: string,
): Promise<UploadResult> {
  const cb = getCircuitBreaker("cloudStorage");
  return cb.executeOrThrow(async () => {
    const client = buildS3Client();
    const bucket = BUCKET();

    const ext = contentType.includes("mp4") ? "mp4" : "mp4";
    const objectKey = `${TRANSFORMS_PREFIX}${jobId}.${ext}`;

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

    return {
      jobId,
      objectKey,
      url,
      filename: `${jobId}.${ext}`,
      size: buffer.length,
      contentType,
    };
  });
}

// ─── Chunked upload sessions (#881) ──────────────────────────────────────────

/**
 * Prefix chunks of an in-progress upload are staged under.
 *
 * Chunks live in the bucket rather than in memory or a separate store, which
 * is what makes an upload resumable across a page reload, a lost connection or
 * a server restart: the set of objects under a session prefix *is* the
 * progress record, so it survives anything that does not lose the bucket.
 */
export const CHUNK_PREFIX =
  process.env.CLOUD_STORAGE_CHUNK_PREFIX ?? "uploads/chunks/";

/** Object key for one chunk of a session. */
function chunkKey(sessionId: string, index: number): string {
  // Zero-padded so a lexicographic S3 listing is also numeric order.
  return `${CHUNK_PREFIX}${sessionId}/${String(index).padStart(6, "0")}`;
}

/** Extract the chunk index from a chunk object key. */
function chunkIndexFromKey(key: string): number | null {
  const index = Number.parseInt(key.slice(key.lastIndexOf("/") + 1), 10);
  return Number.isNaN(index) ? null : index;
}

/**
 * Store one chunk of an in-progress upload.
 *
 * Writing the same index twice is safe and idempotent — a client that retries
 * a chunk whose response it never saw simply overwrites identical bytes.
 */
export async function putUploadChunk(
  sessionId: string,
  index: number,
  body: Buffer,
): Promise<void> {
  const client = buildS3Client();

  await withRetry(() =>
    client.send(
      new PutObjectCommand({
        Bucket: BUCKET(),
        Key: chunkKey(sessionId, index),
        Body: body,
        ContentType: "application/octet-stream",
      }),
    ),
  );
}

/**
 * List the chunk indices already stored for a session.
 *
 * This is the resume handshake: the client asks what arrived and uploads only
 * the gaps.
 */
export async function listUploadChunks(sessionId: string): Promise<number[]> {
  const client = buildS3Client();
  const bucket = BUCKET();
  const prefix = `${CHUNK_PREFIX}${sessionId}/`;

  const indices: number[] = [];
  let continuationToken: string | undefined;

  // A 500MB file at 5MB chunks is 100 objects, but paginate anyway rather than
  // silently truncating at S3's 1000-key page limit.
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of page.Contents ?? []) {
      const index = object.Key ? chunkIndexFromKey(object.Key) : null;
      if (index !== null) indices.push(index);
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return indices.sort((a, b) => a - b);
}

/**
 * Concatenate a session's chunks into a single buffer, in index order.
 *
 * @throws If any chunk in `0..totalChunks-1` is missing, rather than returning
 * a silently truncated file.
 */
export async function assembleUploadChunks(
  sessionId: string,
  totalChunks: number,
): Promise<Buffer> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const stored = new Set(await listUploadChunks(sessionId));
  const missing = Array.from({ length: totalChunks }, (_, i) => i).filter(
    (i) => !stored.has(i),
  );
  if (missing.length > 0) {
    throw new Error(
      `Cannot assemble upload ${sessionId}: missing chunks ${missing.join(", ")}`,
    );
  }

  const parts: Buffer[] = [];
  // Sequential on purpose: order matters and the parts are held in memory.
  for (let index = 0; index < totalChunks; index += 1) {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: chunkKey(sessionId, index) }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Chunk ${index} of upload ${sessionId} is empty`);
    }
    parts.push(Buffer.from(bytes));
  }

  return Buffer.concat(parts);
}

/**
 * Delete every chunk of a session.
 *
 * Called once a session has been assembled or abandoned, so a failed upload
 * does not leave staged bytes behind. Deletion failures are swallowed: the
 * upload itself has already succeeded by then, and a leftover chunk is a
 * lifecycle-rule problem rather than a user-facing one.
 */
export async function discardUploadChunks(sessionId: string): Promise<void> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const indices = await listUploadChunks(sessionId);
  await Promise.all(
    indices.map((index) =>
      client
        .send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: chunkKey(sessionId, index),
          }),
        )
        .catch(() => undefined),
    ),
  );
}
