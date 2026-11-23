// Issue #1367 — magic-byte MIME validation tests, incl. renamed executable.
import { sniffMime, validateMime } from "./mimeSniff";

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s);
const u8 = (arr: number[]) => new Uint8Array(arr);

function ftyp(brand = "isom"): Uint8Array {
  const b = new Uint8Array(32);
  b.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70], 0); // size + "ftyp"
  b.set([...brand].map((c) => c.charCodeAt(0)), 8);
  return b;
}

describe("sniffMime", () => {
  it("detects mp4 via ftyp", () => {
    expect(sniffMime(ftyp("isom"))).toBe("mp4");
    expect(sniffMime(ftyp("qt  "))).toBe("mov");
  });
  it("detects png/jpeg/webp/pdf/zip", () => {
    expect(sniffMime(u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffMime(u8([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffMime(u8([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
    expect(sniffMime(bytes("%PDF-1.7"))).toBe("pdf");
    expect(sniffMime(u8([0x50, 0x4b, 0x03, 0x04]))).toBe("zip");
  });
  it("detects renamed executables and scripts", () => {
    expect(sniffMime(u8([0x4d, 0x5a, 0x90, 0x00]))).toBe("exe");       // PE header
    expect(sniffMime(u8([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]))).toBe("elf");
    expect(sniffMime(bytes("#!/bin/sh\necho hi"))).toBe("script");
  });
});

describe("validateMime", () => {
  it("accepts matching video/mp4", () => {
    expect(validateMime("video/mp4", ftyp()).ok).toBe(true);
  });
  it("rejects mismatched declared type", () => {
    const v = validateMime("image/png", ftyp());
    expect(v.ok).toBe(false);
    expect(v.sniffed).toBe("mp4");
  });
  it("rejects a renamed executable declared as video", () => {
    const v = validateMime("video/mp4", u8([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]));
    expect(v.ok).toBe(false);
    expect(v.sniffed).toBe("exe");
  });
  it("rejects unsupported declared types", () => {
    expect(validateMime("application/x-msdownload", ftyp()).ok).toBe(false);
  });
});
