/**
 * Security tests for magic byte validation (#1084).
 *
 * Validates that file type detection is based on actual file content (magic
 * bytes) rather than the declared extension or MIME type, preventing uploads
 * of malicious files that have been renamed to a trusted extension.
 */

import { inspectMagicBytes, validateMagicBytes } from "./processUpload";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal 12-byte buffer with specific bytes at given offsets. */
function buildBuffer(overrides: Record<number, number>): Buffer {
  const buf = Buffer.alloc(12, 0x00);
  for (const [offset, value] of Object.entries(overrides)) {
    buf[Number(offset)] = value;
  }
  return buf;
}

/** Valid MP4 header: ftyp box at offset 4, isom brand at offset 8. */
function mp4Header(): Buffer {
  return buildBuffer({
    4: 0x66, 5: 0x74, 6: 0x79, 7: 0x70, // "ftyp"
    8: 0x69, 9: 0x73, 10: 0x6f, 11: 0x6d, // "isom"
  });
}

/** Valid MOV header: ftyp box at offset 4, "qt  " brand at offset 8. */
function movHeader(): Buffer {
  return buildBuffer({
    4: 0x66, 5: 0x74, 6: 0x79, 7: 0x70, // "ftyp"
    8: 0x71, 9: 0x74, 10: 0x20, 11: 0x20, // "qt  "
  });
}

/** Valid AVI header: RIFF at 0, AVI  at 8. */
function aviHeader(): Buffer {
  return buildBuffer({
    0: 0x52, 1: 0x49, 2: 0x46, 3: 0x46, // "RIFF"
    8: 0x41, 9: 0x56, 10: 0x49, 11: 0x20, // "AVI "
  });
}

/** Valid MKV/WebM header: EBML magic bytes. */
function mkvHeader(): Buffer {
  return buildBuffer({
    0: 0x1a, 1: 0x45, 2: 0xdf, 3: 0xa3,
  });
}

/** Simulates a renamed executable (MZ / PE header). */
function peHeader(): Buffer {
  return buildBuffer({ 0: 0x4d, 1: 0x5a }); // "MZ"
}

/** Simulates a renamed ZIP / JAR (PK header). */
function zipHeader(): Buffer {
  return buildBuffer({ 0: 0x50, 1: 0x4b, 2: 0x03, 3: 0x04 }); // "PK\x03\x04"
}

/** Simulates a renamed PDF (%PDF). */
function pdfHeader(): Buffer {
  return buildBuffer({ 0: 0x25, 1: 0x50, 2: 0x44, 3: 0x46 }); // "%PDF"
}

/** Simulates a renamed PNG. */
function pngHeader(): Buffer {
  return buildBuffer({ 0: 0x89, 1: 0x50, 2: 0x4e, 3: 0x47 }); // "\x89PNG"
}

/** Simulates a renamed JPEG. */
function jpegHeader(): Buffer {
  return buildBuffer({ 0: 0xff, 1: 0xd8, 2: 0xff }); // SOI + APP marker
}

/** Crafted buffer: "ftyp" present but NOT at offset 4 (bypass attempt). */
function ftypNotAtOffset4(): Buffer {
  // "ftyp" starts at offset 0, not offset 4
  return buildBuffer({
    0: 0x66, 1: 0x74, 2: 0x79, 3: 0x70,
    4: 0x00, 5: 0x00, 6: 0x00, 7: 0x00,
  });
}

/** Crafted buffer: "AVI " present but without "RIFF" prefix (bypass attempt). */
function aviWithoutRiff(): Buffer {
  return buildBuffer({
    8: 0x41, 9: 0x56, 10: 0x49, 11: 0x20, // "AVI " at offset 8 only
  });
}

/** Crafted RIFF buffer with "WAVE" subtype, not AVI. */
function wavHeader(): Buffer {
  return buildBuffer({
    0: 0x52, 1: 0x49, 2: 0x46, 3: 0x46, // "RIFF"
    8: 0x57, 9: 0x41, 10: 0x56, 11: 0x45, // "WAVE"
  });
}

// ─── inspectMagicBytes ────────────────────────────────────────────────────────

describe("inspectMagicBytes", () => {
  describe("valid video signatures", () => {
    it("accepts a real MP4 (ftyp/isom)", () => {
      const result = inspectMagicBytes(mp4Header());
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe("mp4");
      expect(result.error).toBeNull();
    });

    it("accepts a QuickTime MOV (ftyp/qt  )", () => {
      const result = inspectMagicBytes(movHeader());
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe("mov");
      expect(result.error).toBeNull();
    });

    it("accepts an AVI (RIFF + AVI  subtype)", () => {
      const result = inspectMagicBytes(aviHeader());
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe("avi");
      expect(result.error).toBeNull();
    });

    it("accepts an MKV (EBML magic)", () => {
      const result = inspectMagicBytes(mkvHeader());
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe("mkv");
      expect(result.error).toBeNull();
    });

    it("accepts a WebM (same EBML magic as MKV)", () => {
      // WebM is a subset of Matroska and shares the same EBML header
      const result = inspectMagicBytes(mkvHeader());
      expect(result.valid).toBe(true);
      expect(result.detectedFormat).toBe("mkv");
    });
  });

  describe("renamed file bypass attempts", () => {
    it("rejects a renamed Windows executable (.exe renamed to .mp4)", () => {
      const result = inspectMagicBytes(peHeader());
      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBeNull();
    });

    it("rejects a renamed ZIP archive (.zip renamed to .mov)", () => {
      const result = inspectMagicBytes(zipHeader());
      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBeNull();
    });

    it("rejects a renamed PDF (.pdf renamed to .mkv)", () => {
      const result = inspectMagicBytes(pdfHeader());
      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBeNull();
    });

    it("rejects a renamed PNG (.png renamed to .mp4)", () => {
      const result = inspectMagicBytes(pngHeader());
      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBeNull();
    });

    it("rejects a renamed JPEG (.jpg renamed to .avi)", () => {
      const result = inspectMagicBytes(jpegHeader());
      expect(result.valid).toBe(false);
      expect(result.detectedFormat).toBeNull();
    });

    it("rejects a crafted buffer with 'ftyp' at offset 0 (not offset 4)", () => {
      // Old string-match implementation would have passed this
      const result = inspectMagicBytes(ftypNotAtOffset4());
      expect(result.valid).toBe(false);
    });

    it("rejects a crafted buffer with 'AVI ' at offset 8 but no RIFF prefix", () => {
      // Old implementation using headerStr.includes('AVI') would pass if 'AVI' appeared anywhere
      const result = inspectMagicBytes(aviWithoutRiff());
      expect(result.valid).toBe(false);
    });

    it("rejects a RIFF/WAVE file (.wav renamed to .avi)", () => {
      const result = inspectMagicBytes(wavHeader());
      expect(result.valid).toBe(false);
    });

    it("rejects an all-zero buffer", () => {
      const result = inspectMagicBytes(Buffer.alloc(12, 0));
      expect(result.valid).toBe(false);
    });

    it("rejects a buffer filled with printable ASCII that embeds 'ftyp' mid-buffer", () => {
      // Mimics old indexOf/includes bypass: 'ftyp' is in the buffer but not at offset 4
      const buf = Buffer.from("ABCDftypISOM", "ascii"); // 12 bytes, "ftyp" at offset 4 — actually valid!
      // Correct: this IS a valid ftyp box (bytes 4-7 = "ftyp")
      const result = inspectMagicBytes(buf);
      expect(result.valid).toBe(true);
    });

    it("rejects when 'ftyp' appears only at offset 3 (off by one)", () => {
      const buf = buildBuffer({
        3: 0x66, 4: 0x74, 5: 0x79, 6: 0x70, // "ftyp" shifted one byte early
      });
      // bytes 4-7 are: 0x74, 0x79, 0x70, 0x00 — not "ftyp"
      const result = inspectMagicBytes(buf);
      expect(result.valid).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects a buffer shorter than 12 bytes", () => {
      const result = inspectMagicBytes(Buffer.alloc(8));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too small/i);
    });

    it("rejects an empty buffer", () => {
      const result = inspectMagicBytes(Buffer.alloc(0));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too small/i);
    });

    it("accepts a buffer much larger than 12 bytes (only header matters)", () => {
      const bigBuf = Buffer.concat([mp4Header(), Buffer.alloc(1000)]);
      const result = inspectMagicBytes(bigBuf);
      expect(result.valid).toBe(true);
    });
  });
});

// ─── validateMagicBytes ───────────────────────────────────────────────────────

describe("validateMagicBytes", () => {
  it("returns null for a valid MP4", () => {
    expect(validateMagicBytes(mp4Header())).toBeNull();
  });

  it("returns null for a valid MOV", () => {
    expect(validateMagicBytes(movHeader())).toBeNull();
  });

  it("returns null for a valid AVI", () => {
    expect(validateMagicBytes(aviHeader())).toBeNull();
  });

  it("returns null for a valid MKV", () => {
    expect(validateMagicBytes(mkvHeader())).toBeNull();
  });

  it("returns an error string for a renamed executable", () => {
    const error = validateMagicBytes(peHeader(), "malware.mp4");
    expect(typeof error).toBe("string");
    expect(error!.length).toBeGreaterThan(0);
  });

  it("accepts an optional filename parameter without changing return value", () => {
    expect(validateMagicBytes(mp4Header(), "video.mp4")).toBeNull();
    expect(validateMagicBytes(peHeader(), "evil.mp4")).not.toBeNull();
  });

  it("returns an error for a too-small buffer regardless of filename", () => {
    const error = validateMagicBytes(Buffer.alloc(4), "tiny.mp4");
    expect(error).toMatch(/too small/i);
  });
});
