import {
  getContrastRatio,
  meetsWCAG_AA,
  validateBrandCompliance,
  applyBrandKitToEdits,
  INITIAL_BRAND_KITS,
  type BrandKit,
} from "@/app/lib/brandKit";

describe("Brand Kit Library", () => {
  const sampleKit: BrandKit = {
    id: "test-kit",
    workspaceId: "ws-1",
    name: "Test Brand",
    isDefault: true,
    isActive: true,
    autoApplyToNewClips: true,
    palette: {
      primary: "#00E68A",
      secondary: "#7928CA",
      accent: "#FF0080",
      background: "#000000",
      textColor: "#FFFFFF",
    },
    typography: {
      primaryFont: "Inter",
      secondaryFont: "Outfit",
      minFontSizePx: 18,
    },
    watermark: {
      logoUrl: "/logo.png",
      position: "bottom-right",
      opacity: 0.8,
      scale: 0.15,
      marginPx: 20,
    },
    guidelines: {
      enforcePalette: true,
      requireWatermark: true,
      minCaptionFontSize: 18,
      minContrastRatio: 4.5,
    },
    assets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe("getContrastRatio and meetsWCAG_AA", () => {
    it("should calculate high contrast for black and white (21:1)", () => {
      const ratio = getContrastRatio("#FFFFFF", "#000000");
      expect(ratio).toBeGreaterThan(20);
      expect(meetsWCAG_AA(ratio)).toBe(true);
    });

    it("should fail WCAG AA for poor contrast colors", () => {
      // Light gray on white
      const ratio = getContrastRatio("#CCCCCC", "#FFFFFF");
      expect(ratio).toBeLessThan(4.5);
      expect(meetsWCAG_AA(ratio)).toBe(false);
    });
  });

  describe("validateBrandCompliance", () => {
    it("should report compliant when all guidelines are satisfied", () => {
      const report = validateBrandCompliance(sampleKit, {
        captionFontSize: 20,
        hasWatermark: true,
        customColorsUsed: ["#00E68A"],
      });
      expect(report.compliant).toBe(true);
      expect(report.issues.length).toBe(0);
    });

    it("should flag violation when caption font size is below minimum", () => {
      const report = validateBrandCompliance(sampleKit, {
        captionFontSize: 14, // below min 18
        hasWatermark: true,
      });
      expect(report.compliant).toBe(false);
      expect(report.issues.some((i) => i.includes("below minimum"))).toBe(true);
    });

    it("should flag violation when non-brand colors are used under palette enforcement", () => {
      const report = validateBrandCompliance(sampleKit, {
        captionFontSize: 18,
        hasWatermark: true,
        customColorsUsed: ["#123456"], // not in palette
      });
      expect(report.compliant).toBe(false);
      expect(report.issues.some((i) => i.includes("Disallowed non-brand colors"))).toBe(true);
    });

    it("should flag violation when watermark is required but missing", () => {
      const report = validateBrandCompliance(sampleKit, {
        captionFontSize: 18,
        hasWatermark: false,
      });
      expect(report.compliant).toBe(false);
      expect(report.issues.some((i) => i.includes("strictly require watermark"))).toBe(true);
    });
  });

  describe("applyBrandKitToEdits", () => {
    it("should inject brand font, palette, and watermark into clip edits", () => {
      const baseEdits = {
        trimStart: 0,
        trimEnd: 100,
        aspectRatio: "9:16",
      };

      const result = applyBrandKitToEdits(baseEdits, sampleKit);
      expect(result.brandingApplied).toBe(true);
      expect(result.brandKitId).toBe("test-kit");
      expect(result.brandFont).toBe("Inter");
      expect(result.brandPalette.primary).toBe("#00E68A");
      expect(result.watermark.position).toBe("bottom-right");
    });
  });
});
