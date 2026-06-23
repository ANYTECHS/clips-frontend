/**
 * cloudStorage.ts — Issue #442
 *
 * Thin abstraction over S3-compatible cloud storage (AWS S3, GCS via S3
 * interop, or Cloudflare R2).  The active backend is determined entirely by
 * environment variables so no code changes are needed to switch providers.
 *
 * Required env vars:
 *   CLOUD_STORAGE_PROVIDER   — "s3" | "r2" | "gcs"  (default: "s3")
 *   CLOUD_STORAGE_BUCKET     — bucket name
 *   CLOUD_STORAGE_REGION     — region (e.g. "us-east-1"; R2 uses "auto")
 *   CLOUD_STORAGE_ENDPOINT   — custom endpoint URL (required for R2 / GCS S3)
 *   AWS_ACCESS_KEY_ID        — access key / account ID
 *   AWS_SECRET_ACCESS_KEY    — secret key / API token
 *
 * Optional:
 *   CLOUD_STORAGE_KEY_PREFIX — prefix prepended to all object keys (default: "uploads/")
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

// ─── Configuration ────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

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

  const parts: { ETag: string; PartNumber: number }[] = [];

  try {
    let partNumber = 1;
    for (let offset = 0; offset < buffer.length; offset += PART_SIZE) {
      const chunk = buffer.slice(offset, offset + PART_SIZE);
      const { ETag } = await client.send(
        new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId,
          PartNumber: partNumber,
          Body: chunk,
          ContentLength: chunk.length,
        }),
      );
      if (!ETag) throw new Error(`Missing ETag for part ${partNumber}`);
      parts.push({ ETag, PartNumber: partNumber });
      partNumber++;
    }

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId,
        MultipartUpload: { Parts: parts },
      }),
    );
  } catch (err) {
    // Abort the incomplete multipart upload to avoid orphaned storage costs.
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
 * @param jobId Job ID of the file to move
 * @param filename Original filename (used to determine extension)
 * @returns UploadResult with the final object key and URL
 */
export async function moveFromQuarantine(jobId: string, filename: string): Promise<UploadResult> {
  const client = buildS3Client();
  const bucket = BUCKET();

  const ext = filename.split(".").pop() ?? "bin";
  const quarantineKey = `${QUARANTINE_PREFIX}${jobId}.${ext}`;
  const finalKey = `${KEY_PREFIX}${jobId}.${ext}`;

  // Copy from quarantine to final location
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${quarantineKey}`,
      Key: finalKey,
    }),
  );

  // Delete from quarantine
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: quarantineKey,
    }),
  );

  // Build the final URL
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
    size: 0, // Size unknown after move (could fetch via HeadObject if needed)
    contentType: "application/octet-stream",
  };
}

/**
 * Delete a file from S3 (used for infected files).
 *
 * @param objectKey Full object key to delete (including prefix)
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
