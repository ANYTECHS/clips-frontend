import { JobRestartSchema, UploadFormSchema, parseBody } from "@/app/api/schemas";

// ── JobRestartSchema ──────────────────────────────────────────────────────────

describe("JobRestartSchema", () => {
  it("accepts an empty body", () => {
    expect(JobRestartSchema.safeParse({}).success).toBe(true);
  });

  it("accepts action: restart", () => {
    expect(JobRestartSchema.safeParse({ action: "restart" }).success).toBe(true);
  });

  it("rejects unknown action values", () => {
    expect(JobRestartSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});

// ── UploadFormSchema ──────────────────────────────────────────────────────────

describe("UploadFormSchema", () => {
  const makeFile = (name = "video.mp4") =>
    new File(["data"], name, { type: "video/mp4" });

  it("accepts a single file", () => {
    expect(UploadFormSchema.safeParse({ files: [makeFile()] }).success).toBe(true);
  });

  it("rejects an empty files array", () => {
    expect(UploadFormSchema.safeParse({ files: [] }).success).toBe(false);
  });

  it("rejects missing files field", () => {
    expect(UploadFormSchema.safeParse({}).success).toBe(false);
  });

  it("rejects non-File entries", () => {
    expect(UploadFormSchema.safeParse({ files: ["not-a-file"] }).success).toBe(false);
  });
});

// ── parseBody helper ──────────────────────────────────────────────────────────

describe("parseBody", () => {
  it("returns ok:true with data on success", () => {
    const result = parseBody(JobRestartSchema, {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeDefined();
  });

  it("returns ok:false with structured error on invalid input", () => {
    const result = parseBody(JobRestartSchema, { action: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.result.error).toBe("Validation failed");
      expect(Array.isArray(result.result.issues)).toBe(true);
      expect(result.result.issues.length).toBeGreaterThan(0);
    }
  });
});
