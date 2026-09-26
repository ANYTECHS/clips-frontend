import { transcodeBodySchema } from "@/app/api/schemas/exports.schema";
import { getMaxExportQuality, isExportQualityAllowed } from "@/app/lib/planLimits";

describe("export quality validation", () => {
  it("accepts source quality for original-resolution exports", () => {
    expect(
      transcodeBodySchema.safeParse({
        format: "mp4",
        aspectRatio: "9:16",
        quality: "source",
      }).success,
    ).toBe(true);
  });

  it("keeps free plans on 720p and allows source quality for paid plans", () => {
    expect(getMaxExportQuality("free")).toBe("720p");
    expect(isExportQualityAllowed("free", "source")).toBe(false);
    expect(isExportQualityAllowed("pro", "source")).toBe(true);
  });
});
