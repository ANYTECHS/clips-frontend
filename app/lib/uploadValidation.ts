import { MAX_UPLOAD_SIZE_BYTES } from "@/app/lib/constants";

export const MAX_UPLOAD_SIZE_MESSAGE = `Files must be ${formatUploadSize(MAX_UPLOAD_SIZE_BYTES)} or smaller.`;

export function formatUploadSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function validateUploadFile(file: Pick<File, "name" | "size">): string | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `"${file.name}" is too large. ${MAX_UPLOAD_SIZE_MESSAGE}`;
  }
  return null;
}

export function validateUploadFiles(files: Array<Pick<File, "name" | "size">>): string[] {
  return files.flatMap((file) => {
    const error = validateUploadFile(file);
    return error ? [error] : [];
  });
}
