"use client";

import apiClient from "./apiClient";
import { uploadToCloudinary, type CloudinaryUploadResult } from "./uploadToCloudinary";
import {
  BYTES_PER_MB,
  HYBRID_UPLOAD_THRESHOLD_BYTES,
  MAX_VIDEO_FILE_SIZE_BYTES,
  PROGRESS_COMPLETE,
  PROGRESS_INDETERMINATE,
} from "./constants";

// Files <95MB upload to Cloudinary; >=95MB stream directly to Cloudflare R2

export interface StorageUploadResult {
  url: string;
  publicId: string;
  bytes: number;
  duration: number | null;
  storageProvider: "cloudinary" | "r2";
  videoId?: string;
}

function sendPutWithProgress(
  targetUrl: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", targetUrl, true);

    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    }

    xhr.upload.onprogress = (e) => {
      onProgress(
        e.lengthComputable
          ? Math.round((e.loaded / e.total) * PROGRESS_COMPLETE)
          : PROGRESS_INDETERMINATE
      );
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Upload could not be completed. Please try again."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("NETWORK_OR_CORS_ERROR"));
    };

    xhr.send(file);
  });
}

export async function uploadVideoToStorage(
  file: File,
  onProgress: (pct: number) => void
): Promise<StorageUploadResult> {
  if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new Error(
      `File size ${(file.size / BYTES_PER_MB).toFixed(1)} MB exceeds the maximum 1 GB upload limit.`
    );
  }

  if (file.size < HYBRID_UPLOAD_THRESHOLD_BYTES) {
    const result: CloudinaryUploadResult = await uploadToCloudinary(file, onProgress);
    return {
      url: result.secureUrl,
      publicId: result.publicId,
      bytes: result.bytes,
      duration: result.duration,
      storageProvider: "cloudinary",
    };
  }

  const contentType = file.type || "video/mp4";

  const response = await apiClient.post("/videos/r2/presign-upload", {
    fileName: file.name,
    contentType,
    fileSize: file.size,
  });

  const data = response.data?.data || response.data;
  const uploadUrl: string = data?.uploadUrl || data?.presignedUrl || data?.url;
  const publicUrl: string | undefined =
    data?.publicUrl ||
    data?.sourceUrl ||
    data?.fileUrl ||
    (typeof uploadUrl === "string" ? uploadUrl.split("?")[0] : undefined);
  const publicId: string =
    data?.publicId || data?.key || data?.objectKey || `r2_${Date.now()}_${file.name}`;

  if (!uploadUrl) {
    throw new Error("Unable to initialize upload. Please try again.");
  }

  try {
    await sendPutWithProgress(uploadUrl, file, contentType, onProgress);
  } catch (err: any) {
    if (err.message === "NETWORK_OR_CORS_ERROR") {
      const proxyUrl = `/api/r2-proxy?url=${encodeURIComponent(uploadUrl)}`;
      try {
        await sendPutWithProgress(proxyUrl, file, contentType, onProgress);
      } catch {
        throw new Error("Video upload failed. Please check your internet connection and try again.");
      }
    } else {
      throw err;
    }
  }

  return {
    url: publicUrl || uploadUrl.split("?")[0],
    publicId,
    bytes: file.size,
    duration: null,
    storageProvider: "r2",
  };
}
