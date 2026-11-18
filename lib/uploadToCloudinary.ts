"use client";

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  originalFilename: string;
  duration: number | null;
  bytes: number;
  resourceType: string;
}

// Uploads a File directly from the browser to Cloudinary via unsigned preset
export function uploadToCloudinary(
  file: File,
  onProgress: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const cloudName    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(
        new Error(
          "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and " +
          "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment variables."
        )
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "clipcash_videos");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      } else {
        onProgress(-1);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            secureUrl:        data.secure_url,
            publicId:         data.public_id,
            originalFilename: data.original_filename ?? file.name,
            duration:         typeof data.duration === "number" ? data.duration : null,
            bytes:            data.bytes ?? file.size,
            resourceType:     data.resource_type ?? "video",
          });
        } catch {
          reject(new Error("Failed to parse Cloudinary response."));
        }
      } else {
        let msg = "Cloudinary upload failed.";
        try {
          const errData = JSON.parse(xhr.responseText);
          msg = errData?.error?.message ?? msg;
        } catch {
          msg = `Cloudinary upload failed with status ${xhr.status}.`;
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during Cloudinary upload. Please check your connection."));
    };

    xhr.send(formData);
  });
}
