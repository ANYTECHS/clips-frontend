import {
  HEX_PAIR_LENGTH,
  LUMINANCE_COEFFICIENT_B,
  LUMINANCE_COEFFICIENT_G,
  LUMINANCE_COEFFICIENT_R,
  RGB_CHANNEL_MAX,
  SRGB_GAMMA_EXPONENT,
  SRGB_GAMMA_OFFSET,
  SRGB_GAMMA_SCALE,
  SRGB_LINEAR_SLOPE_DIVISOR,
  SRGB_LINEARIZATION_THRESHOLD,
  WCAG_AA_MIN_CONTRAST_RATIO,
  WCAG_CONTRAST_OFFSET,
} from "@/app/lib/constants";

export interface BrandAsset {
  id: string;
  name: string;
  url: string;
  type: "logo" | "watermark" | "font";
  fileSize?: number;
  uploadedAt: string;
}

export interface BrandColorPalette {
  primary: string; // e.g. "#00E68A"
  secondary: string; // e.g. "#7928CA"
  accent: string; // e.g. "#FF0080"
  background: string; // e.g. "#0B0C0E"
  textColor: string; // e.g. "#FFFFFF"
}

export interface BrandTypography {
  primaryFont: string; // e.g. "Inter"
  secondaryFont: string; // e.g. "Outfit"
  minFontSizePx: number; // e.g. 18
  customFontUrl?: string;
}

export interface BrandWatermarkConfig {
  logoUrl?: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity: number; // 0.1 to 1.0
  scale: number; // 0.05 to 0.3
  marginPx: number;
}

export interface BrandGuidelines {
  enforcePalette: boolean; // Disallow non-brand colors
  requireWatermark: boolean; // Watermark cannot be turned off
  minCaptionFontSize: number; // e.g. 18
  minContrastRatio: number; // WCAG AA is 4.5:1
}

export interface BrandKit {
  id: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  autoApplyToNewClips: boolean;
  palette: BrandColorPalette;
  typography: BrandTypography;
  watermark: BrandWatermarkConfig;
  guidelines: BrandGuidelines;
  assets: BrandAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandComplianceReport {
  compliant: boolean;
  issues: string[];
  contrastRatio: number;
  passesWCAG: boolean;
}

/**
 * Calculates relative luminance for WCAG contrast calculation
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, HEX_PAIR_LENGTH), 16) / RGB_CHANNEL_MAX;
  const g =
    parseInt(cleanHex.substring(HEX_PAIR_LENGTH, HEX_PAIR_LENGTH * 2), 16) / RGB_CHANNEL_MAX;
  const b =
    parseInt(cleanHex.substring(HEX_PAIR_LENGTH * 2, HEX_PAIR_LENGTH * 3), 16) / RGB_CHANNEL_MAX;

  const a = [r, g, b].map((v) => {
    return v <= SRGB_LINEARIZATION_THRESHOLD
      ? v / SRGB_LINEAR_SLOPE_DIVISOR
      : Math.pow((v + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE, SRGB_GAMMA_EXPONENT);
  });

  return (
    a[0] * LUMINANCE_COEFFICIENT_R + a[1] * LUMINANCE_COEFFICIENT_G + a[2] * LUMINANCE_COEFFICIENT_B
  );
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  try {
    const lum1 = getLuminance(hex1);
    const lum2 = getLuminance(hex2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const ratio = (brightest + WCAG_CONTRAST_OFFSET) / (darkest + WCAG_CONTRAST_OFFSET);
    return parseFloat(ratio.toFixed(2));
  } catch {
    return WCAG_AA_MIN_CONTRAST_RATIO; // fallback standard
  }
}

/**
 * Check if contrast ratio meets WCAG AA standard (>= 4.5:1 for normal text)
 */
export function meetsWCAG_AA(ratio: number): boolean {
  return ratio >= WCAG_AA_MIN_CONTRAST_RATIO;
}

/**
 * Validates whether brand kit configuration or clip edits comply with brand guidelines
 */
export function validateBrandCompliance(
  brandKit: BrandKit,
  clipEdits?: {
    captionStyle?: string;
    captionFontSize?: number;
    hasWatermark?: boolean;
    customColorsUsed?: string[];
  }
): BrandComplianceReport {
  const issues: string[] = [];
  const contrastRatio = getContrastRatio(brandKit.palette.textColor, brandKit.palette.background);
  const passesWCAG =
    contrastRatio >= (brandKit.guidelines.minContrastRatio || WCAG_AA_MIN_CONTRAST_RATIO);

  if (!passesWCAG) {
    issues.push(
      `Text color (${brandKit.palette.textColor}) and background (${brandKit.palette.background}) contrast ratio is ${contrastRatio}:1 (minimum required is ${brandKit.guidelines.minContrastRatio}:1 for WCAG AA).`
    );
  }

  if (brandKit.guidelines.requireWatermark && !brandKit.watermark.logoUrl) {
    issues.push(
      "Guidelines require a watermark logo, but no logo has been uploaded or configured."
    );
  }

  if (clipEdits) {
    if (brandKit.guidelines.requireWatermark && clipEdits.hasWatermark === false) {
      issues.push("Brand guidelines strictly require watermark branding on all clip exports.");
    }

    if (
      clipEdits.captionFontSize !== undefined &&
      clipEdits.captionFontSize < brandKit.guidelines.minCaptionFontSize
    ) {
      issues.push(
        `Caption font size (${clipEdits.captionFontSize}px) is below minimum brand standard (${brandKit.guidelines.minCaptionFontSize}px).`
      );
    }

    if (
      brandKit.guidelines.enforcePalette &&
      clipEdits.customColorsUsed &&
      clipEdits.customColorsUsed.length > 0
    ) {
      const allowedColors = [
        brandKit.palette.primary.toLowerCase(),
        brandKit.palette.secondary.toLowerCase(),
        brandKit.palette.accent.toLowerCase(),
        brandKit.palette.background.toLowerCase(),
        brandKit.palette.textColor.toLowerCase(),
      ];
      const disallowed = clipEdits.customColorsUsed.filter(
        (c) => !allowedColors.includes(c.toLowerCase())
      );
      if (disallowed.length > 0) {
        issues.push(
          `Disallowed non-brand colors used: ${disallowed.join(", ")}. Palette enforcement is active.`
        );
      }
    }
  }

  return {
    compliant: issues.length === 0,
    issues,
    contrastRatio,
    passesWCAG,
  };
}

/**
 * Applies active brand kit styling and watermark to clip edits
 */
export function applyBrandKitToEdits<T extends Record<string, any>>(
  baseEdits: T,
  brandKit: BrandKit
): T & {
  brandingApplied: boolean;
  brandKitId: string;
  brandPalette: BrandColorPalette;
  watermark: BrandWatermarkConfig;
  brandFont: string;
} {
  return {
    ...baseEdits,
    brandingApplied: true,
    brandKitId: brandKit.id,
    brandPalette: brandKit.palette,
    watermark: brandKit.watermark,
    brandFont: brandKit.typography.primaryFont,
  };
}

export const INITIAL_BRAND_KITS: BrandKit[] = [
  {
    id: "kit-default-01",
    workspaceId: "workspace-main",
    name: "Clips Neon (Primary)",
    isDefault: true,
    isActive: true,
    autoApplyToNewClips: true,
    palette: {
      primary: "#00E68A",
      secondary: "#7928CA",
      accent: "#FF0080",
      background: "#0B0C0E",
      textColor: "#FFFFFF",
    },
    typography: {
      primaryFont: "Inter",
      secondaryFont: "Outfit",
      minFontSizePx: 18,
    },
    watermark: {
      logoUrl: "/icons/logo.svg",
      position: "bottom-right",
      opacity: 0.85,
      scale: 0.15,
      marginPx: 24,
    },
    guidelines: {
      enforcePalette: true,
      requireWatermark: false,
      minCaptionFontSize: 18,
      minContrastRatio: 4.5,
    },
    assets: [
      {
        id: "asset-1",
        name: "Primary Logo (SVG)",
        url: "/icons/logo.svg",
        type: "logo",
        uploadedAt: "2026-09-01T10:00:00Z",
      },
    ],
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-24T12:00:00Z",
  },
  {
    id: "kit-corporate-02",
    workspaceId: "workspace-main",
    name: "Enterprise Studio",
    isDefault: false,
    isActive: false,
    autoApplyToNewClips: false,
    palette: {
      primary: "#3B82F6",
      secondary: "#1E293B",
      accent: "#F59E0B",
      background: "#0F172A",
      textColor: "#F8FAFC",
    },
    typography: {
      primaryFont: "Roboto",
      secondaryFont: "Inter",
      minFontSizePx: 20,
    },
    watermark: {
      logoUrl: "/icons/watermark-studio.svg",
      position: "top-right",
      opacity: 0.9,
      scale: 0.12,
      marginPx: 32,
    },
    guidelines: {
      enforcePalette: true,
      requireWatermark: true,
      minCaptionFontSize: 20,
      minContrastRatio: 4.5,
    },
    assets: [],
    createdAt: "2026-09-10T14:30:00Z",
    updatedAt: "2026-09-20T16:00:00Z",
  },
];
