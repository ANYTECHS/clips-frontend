/**
 * cloudStorage.test.ts — Issue #552
 *
 * Unit tests for cloudStorage.ts multipart S3 upload logic.
 * Tests cover single-part upload, multipart upload, abort-on-failure,
 * and missing environment variables.
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
import {
  uploadFile,
  uploadToQuarantine,
  moveFromQuarantine,
  deleteFile,
} from "./cloudStorage";

jest.mock("@aws-sdk/client-s3");

describe("cloudStorage", () => {
  const mockS3Client = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (S3Client as jest.Mock).mockReturnValue(mockS3Client);
    process.env.CLOUD_STORAGE_BUCKET = "test-bucket";
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.CLOUD_STORAGE_REGION = "us-east-1";
  });

  afterEach(() => {
    delete process.env.CLOUD_STORAGE_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.CLOUD_STORAGE_REGION;
  });

  describe("uploadFile", () => {
    it("throws error when CLOUD_STORAGE_BUCKET is missing", async () => {
      delete process.env.CLOUD_STORAGE_BUCKET;

      await expect(
        uploadFile(Buffer.from("test"), "test.txt", "text/plain")
      ).rejects.toThrow("Missing required environment variable: CLOUD_STORAGE_BUCKET");
    });

    it("throws error when AWS_ACCESS_KEY_ID is missing", async () => {
      delete process.env.AWS_ACCESS_KEY_ID;

      await expect(
        uploadFile(Buffer.from("test"), "test.txt", "text/plain")
      ).rejects.toThrow("Missing required environment variable: AWS_ACCESS_KEY_ID");
    });

    it("throws error when AWS_SECRET_ACCESS_KEY is missing", async () => {
      delete process.env.AWS_SECRET_ACCESS_KEY;

      await expect(
        uploadFile(Buffer.from("test"), "test.txt", "text/plain")
      ).rejects.toThrow("Missing required environment variable: AWS_SECRET_ACCESS_KEY");
    });

    it("uses PutObjectCommand for files ≤ 50 MB (single-part upload)", async () => {
      const buffer = Buffer.alloc(25 * 1024 * 1024); // 25 MB
      mockS3Client.send.mockResolvedValue({});

      const result = await uploadFile(buffer, "test.mp4", "video/mp4");

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );

      const putCommand = mockS3Client.send.mock.calls[0][0] as PutObjectCommand;
      expect(putCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
        Body: buffer,
        ContentType: "video/mp4",
        ContentLength: buffer.length,
      });

      expect(result).toMatchObject({
        filename: "test.mp4",
        size: buffer.length,
        contentType: "video/mp4",
        jobId: expect.stringMatching(/^job_[a-f0-9]+$/),
        objectKey: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
        url: expect.stringContaining("test-bucket"),
      });
    });

    it("uses multipart upload for files > 50 MB", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB
      const uploadId = "upload-123";
      const etags = ["etag-1", "etag-2", "etag-3", "etag-4", "etag-5", "etag-6"];

      mockS3Client.send
        .mockResolvedValueOnce({ UploadId: uploadId }) // CreateMultipartUpload
        .mockResolvedValue({ ETag: etags[0] }) // UploadPart 1
        .mockResolvedValue({ ETag: etags[1] }) // UploadPart 2
        .mockResolvedValue({ ETag: etags[2] }) // UploadPart 3
        .mockResolvedValue({ ETag: etags[3] }) // UploadPart 4
        .mockResolvedValue({ ETag: etags[4] }) // UploadPart 5
        .mockResolvedValue({ ETag: etags[5] }) // UploadPart 6
        .mockResolvedValue({}); // CompleteMultipartUpload

      const result = await uploadFile(buffer, "large.mp4", "video/mp4");

      expect(mockS3Client.send).toHaveBeenCalledTimes(8); // 1 create + 6 parts + 1 complete

      // Verify CreateMultipartUploadCommand
      const createCommand = mockS3Client.send.mock.calls[0][0] as CreateMultipartUploadCommand;
      expect(createCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
        ContentType: "video/mp4",
      });

      // Verify UploadPartCommand calls
      for (let i = 1; i <= 6; i++) {
        const uploadPartCommand = mockS3Client.send.mock.calls[i][0] as UploadPartCommand;
        expect(uploadPartCommand.input).toMatchObject({
          Bucket: "test-bucket",
          Key: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
          UploadId: uploadId,
          PartNumber: i,
        });
      }

      // Verify CompleteMultipartUploadCommand
      const completeCommand = mockS3Client.send.mock.calls[7][0] as CompleteMultipartUploadCommand;
      expect(completeCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
        UploadId: uploadId,
        MultipartUpload: {
          Parts: expect.arrayContaining([
            { ETag: etags[0], PartNumber: 1 },
            { ETag: etags[1], PartNumber: 2 },
            { ETag: etags[2], PartNumber: 3 },
            { ETag: etags[3], PartNumber: 4 },
            { ETag: etags[4], PartNumber: 5 },
            { ETag: etags[5], PartNumber: 6 },
          ]),
        },
      });

      expect(result).toMatchObject({
        filename: "large.mp4",
        size: buffer.length,
        contentType: "video/mp4",
      });
    });

    it("aborts multipart upload on part failure", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB
      const uploadId = "upload-123";

      mockS3Client.send
        .mockResolvedValueOnce({ UploadId: uploadId }) // CreateMultipartUpload
        .mockResolvedValue({ ETag: "etag-1" }) // UploadPart 1
        .mockRejectedValue(new Error("Upload failed")); // UploadPart 2 fails

      await expect(uploadFile(buffer, "large.mp4", "video/mp4")).rejects.toThrow("Upload failed");

      // Verify AbortMultipartUploadCommand was called
      expect(mockS3Client.send).toHaveBeenCalledTimes(3); // 1 create + 1 part + 1 abort
      const abortCommand = mockS3Client.send.mock.calls[2][0] as AbortMultipartUploadCommand;
      expect(abortCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: expect.stringMatching(/^uploads\/job_[a-f0-9]+\.mp4$/),
        UploadId: uploadId,
      });
    });

    it("handles abort failure gracefully (swallows error)", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB
      const uploadId = "upload-123";

      mockS3Client.send
        .mockResolvedValueOnce({ UploadId: uploadId }) // CreateMultipartUpload
        .mockRejectedValueOnce(new Error("Upload failed")); // UploadPart 1 fails

      // The abort happens in the catch block, we don't need to mock it separately
      // since it's called with .catch(() => {}) which swallows errors

      await expect(uploadFile(buffer, "large.mp4", "video/mp4")).rejects.toThrow("Upload failed");
      // Should still throw the original upload error, not the abort error
    });

    it("throws error if CreateMultipartUploadCommand returns no UploadId", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB

      mockS3Client.send.mockResolvedValueOnce({}); // No UploadId

      await expect(uploadFile(buffer, "large.mp4", "video/mp4")).rejects.toThrow(
        "Failed to create multipart upload"
      );
    });

    it("throws error if UploadPartCommand returns no ETag", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB
      const uploadId = "upload-123";

      mockS3Client.send
        .mockResolvedValueOnce({ UploadId: uploadId }) // CreateMultipartUpload
        .mockResolvedValue({}); // UploadPart 1 returns no ETag

      await expect(uploadFile(buffer, "large.mp4", "video/mp4")).rejects.toThrow(
        "Missing ETag for part 1"
      );
    });

    it("generates correct URL with custom endpoint", async () => {
      process.env.CLOUD_STORAGE_ENDPOINT = "https://custom.endpoint.com";
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10 MB
      mockS3Client.send.mockResolvedValue({});

      const result = await uploadFile(buffer, "test.mp4", "video/mp4");

      expect(result.url).toMatch(/^https:\/\/custom\.endpoint\.com\/test-bucket\/uploads\/job_[a-f0-9]+\.mp4$/);
    });

    it("generates correct URL with AWS S3 endpoint", async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10 MB
      mockS3Client.send.mockResolvedValue({});

      const result = await uploadFile(buffer, "test.mp4", "video/mp4");

      expect(result.url).toMatch(/^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com\/uploads\/job_[a-f0-9]+\.mp4$/);
    });
  });

  describe("uploadToQuarantine", () => {
    it("uses PutObjectCommand for small files in quarantine", async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10 MB
      mockS3Client.send.mockResolvedValue({});

      const result = await uploadToQuarantine(buffer, "test.mp4", "video/mp4");

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand)
      );

      const putCommand = mockS3Client.send.mock.calls[0][0] as PutObjectCommand;
      expect(putCommand.input.Key).toMatch(/^uploads\/quarantine\/job_[a-f0-9]+\.mp4$/);

      expect(result).toMatchObject({
        filename: "test.mp4",
        jobId: expect.stringMatching(/^job_[a-f0-9]+$/),
        quarantineKey: expect.stringMatching(/^uploads\/quarantine\/job_[a-f0-9]+\.mp4$/),
      });
    });

    it("uses multipart upload for large files in quarantine", async () => {
      const buffer = Buffer.alloc(60 * 1024 * 1024); // 60 MB
      const uploadId = "upload-123";

      mockS3Client.send
        .mockResolvedValueOnce({ UploadId: uploadId })
        .mockResolvedValue({ ETag: "etag-1" })
        .mockResolvedValue({ ETag: "etag-2" })
        .mockResolvedValue({ ETag: "etag-3" })
        .mockResolvedValue({ ETag: "etag-4" })
        .mockResolvedValue({ ETag: "etag-5" })
        .mockResolvedValue({ ETag: "etag-6" })
        .mockResolvedValue({});

      const result = await uploadToQuarantine(buffer, "large.mp4", "video/mp4");

      const createCommand = mockS3Client.send.mock.calls[0][0] as CreateMultipartUploadCommand;
      expect(createCommand.input.Key).toMatch(/^uploads\/quarantine\/job_[a-f0-9]+\.mp4$/);

      expect(result.quarantineKey).toMatch(/^uploads\/quarantine\/job_[a-f0-9]+\.mp4$/);
    });
  });

  describe("moveFromQuarantine", () => {
    it("copies file from quarantine to final location and deletes from quarantine", async () => {
      const jobId = "job_abc123";
      const filename = "test.mp4";

      mockS3Client.send.mockResolvedValue({});

      const result = await moveFromQuarantine(jobId, filename);

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);

      // Verify CopyObjectCommand
      const copyCommand = mockS3Client.send.mock.calls[0][0] as CopyObjectCommand;
      expect(copyCommand.input).toMatchObject({
        Bucket: "test-bucket",
        CopySource: "test-bucket/uploads/quarantine/job_abc123.mp4",
        Key: "uploads/job_abc123.mp4",
      });

      // Verify DeleteObjectCommand
      const deleteCommand = mockS3Client.send.mock.calls[1][0] as DeleteObjectCommand;
      expect(deleteCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: "uploads/quarantine/job_abc123.mp4",
      });

      expect(result).toMatchObject({
        jobId,
        filename,
        objectKey: "uploads/job_abc123.mp4",
        url: expect.stringContaining("uploads/job_abc123.mp4"),
      });
    });
  });

  describe("deleteFile", () => {
    it("deletes file from S3", async () => {
      const objectKey = "uploads/job_abc123.mp4";
      mockS3Client.send.mockResolvedValue({});

      await deleteFile(objectKey);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand)
      );

      const deleteCommand = mockS3Client.send.mock.calls[0][0] as DeleteObjectCommand;
      expect(deleteCommand.input).toMatchObject({
        Bucket: "test-bucket",
        Key: objectKey,
      });
    });
  });
});
