import { describe, expect, it } from "@jest/globals";
import { MAX_UPLOAD_SIZE_BYTES } from "@/app/lib/constants";
import { validateUploadFile, validateUploadFiles } from "./uploadValidation";

describe("uploadValidation", () => {
  it("accepts files at the limit and rejects files above it", () => {
    expect(validateUploadFile({ name: "at-limit.mp4", size: MAX_UPLOAD_SIZE_BYTES })).toBeNull();
    expect(validateUploadFile({ name: "too-large.mp4", size: MAX_UPLOAD_SIZE_BYTES + 1 })).toMatch(
      /too-large\.mp4.*500 MB/i,
    );
  });

  it("validates every file in a batch", () => {
    expect(validateUploadFiles([
      { name: "ok.mp4", size: 1 },
      { name: "large.mov", size: MAX_UPLOAD_SIZE_BYTES + 10 },
    ])).toEqual(['"large.mov" is too large. Files must be 500 MB or smaller.']);
  });
});
