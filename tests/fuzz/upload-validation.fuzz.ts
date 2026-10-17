import fc from "fast-check";
import { MAX_UPLOAD_SIZE_BYTES } from "@/app/lib/constants";
import { validateUploadFile } from "@/app/lib/uploadValidation";

const SEED = Number(process.env.FC_SEED ?? 1277);

describe("upload metadata fuzz properties", () => {
  it("never crashes and rejects exactly files larger than the configured maximum", () => {
    try {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 2_048 }),
          fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
          (name, size) => {
            const error = validateUploadFile({ name, size });
            expect(error === null).toBe(size <= MAX_UPLOAD_SIZE_BYTES);
          },
        ),
        { numRuns: 1_000, seed: SEED },
      );
    } catch (error) {
      console.error(`[fast-check] upload-validation seed=${SEED}`);
      throw error;
    }
  });

  it("handles random MIME-like metadata strings without throwing", () => {
    try {
      fc.assert(
        fc.property(fc.string({ maxLength: 256 }), fc.integer({ min: 0 }), (mimeType, size) => {
          expect(typeof mimeType).toBe("string");
          expect(validateUploadFile({ name: `file.${mimeType}`, size })).toEqual(
            size > MAX_UPLOAD_SIZE_BYTES
              ? expect.stringMatching(/too large/i)
              : null,
          );
        }),
        { numRuns: 1_000, seed: SEED + 1 },
      );
    } catch (error) {
      console.error(`[fast-check] upload-mime seed=${SEED + 1}`);
      throw error;
    }
  });
});
