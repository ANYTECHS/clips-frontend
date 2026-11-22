// Issue #1367 — server-side MIME validation via magic bytes.
// Client-supplied Content-Type can be spoofed; we sniff the first bytes of
// the payload and compare against the declared type before proxying.

export type SniffedKind =
  | "mp4" | "webm" | "mov" | "avi" | "mpeg" | "mp3"
  | "jpeg" | "png" | "gif" | "webp" | "pdf" | "zip"
  | "exe" | "elf" | "script" | "unknown";

export interface MimeVerdict {
  ok: boolean;
  sniffed: SniffedKind;
  reason?: string;
}

// Declared Content-Type → acceptable sniffed kinds.
const ALLOWED: Record<string, SniffedKind[]> = {
  "video/mp4": ["mp4", "mov"],
  "video/quicktime": ["mov", "mp4"],
  "video/webm": ["webm"],
  "video/x-matroska": ["webm"],
  "video/x-msvideo": ["avi"],
  "video/mpeg": ["mpeg"],
  "audio/mpeg": ["mp3", "mpeg"],
  "image/jpeg": ["jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
  "application/zip": ["zip"],
  "application/x-zip-compressed": ["zip"],
};

export function sniffMime(head: Uint8Array): SniffedKind {
  const b = (i: number) => head[i];
  // ISO BMFF / MP4 / MOV: bytes 4..8 == "ftyp"
  if (head.length >= 12 && b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) {
    const brand = String.fromCharCode(b(8), b(9), b(10), b(11));
    if (brand === "qt  ") return "mov";
    return "mp4";
  }
  // WebM / Matroska EBML header
  if (head.length >= 4 && b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return "webm";
  // AVI RIFF
  if (head.length >= 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
      b(8) === 0x41 && b(9) === 0x56 && b(10) === 0x49) return "avi";
  // JPEG
  if (head.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpeg";
  // PNG
  if (head.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "png";
  // GIF
  if (head.length >= 6 && b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return "gif";
  // WebP RIFF....WEBP
  if (head.length >= 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
      b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "webp";
  // PDF
  if (head.length >= 5 && b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "pdf";
  // ZIP (docx/xlsx/jar)
  if (head.length >= 4 && b(0) === 0x50 && b(1) === 0x4b && (b(2) === 0x03 || b(2) === 0x05 || b(2) === 0x07)) return "zip";
  // MPEG-PS / MPEG-ES
  if (head.length >= 4 && b(0) === 0x00 && b(1) === 0x00 && b(2) === 0x01 && (b(3) === 0xba || b(3) === 0xb3)) return "mpeg";
  // MP3 ID3 or frame sync
  if (head.length >= 3 && b(0) === 0x49 && b(1) === 0x44 && b(2) === 0x33) return "mp3";
  if (head.length >= 2 && b(0) === 0xff && (b(1) & 0xe0) === 0xe0) return "mp3";
  // PE executable (renamed .exe)
  if (head.length >= 2 && b(0) === 0x4d && b(1) === 0x5a) return "exe";
  // ELF
  if (head.length >= 4 && b(0) === 0x7f && b(1) === 0x45 && b(2) === 0x4c && b(3) === 0x46) return "elf";
  // Script shebang
  if (head.length >= 2 && b(0) === 0x23 && b(1) === 0x21) return "script";
  return "unknown";
}

/**
 * Compares declared Content-Type with sniffed magic bytes.
 * Unknown declared types are rejected — uploads must declare a type we
 * can verify. Executables/scripts are always rejected.
 */
export function validateMime(declaredType: string, head: Uint8Array): MimeVerdict {
  const sniffed = sniffMime(head);
  if (sniffed === "exe" || sniffed === "elf" || sniffed === "script") {
    return { ok: false, sniffed, reason: "Executable or script content is not allowed." };
  }
  const declared = declaredType.split(";")[0].trim().toLowerCase();
  const allowed = ALLOWED[declared];
  if (!allowed) {
    return { ok: false, sniffed, reason: `Unsupported content type: ${declared}` };
  }
  if (!allowed.includes(sniffed)) {
    return {
      ok: false,
      sniffed,
      reason: `Content does not match declared type ${declared} (detected: ${sniffed}).`,
    };
  }
  return { ok: true, sniffed };
}
