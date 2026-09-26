/**
 * animeTransform.ts
 *
 * Shared types and validation logic for the anime-style transformation
 * options. Imported by both the UI components and the API routes so the
 * client and server stay in sync without duplication.
 */

// ─── Sub-style ────────────────────────────────────────────────────────────────

export const ANIME_SUB_STYLES = [
  "shonen",
  "shojo",
  "chibi",
  "mecha",
  "ghibli-inspired",
] as const;

export type AnimeSubStyle = (typeof ANIME_SUB_STYLES)[number];

export interface AnimeSubStyleMeta {
  /** Machine identifier */
  value: AnimeSubStyle;
  /** Human-readable label */
  label: string;
  /** Short description shown in the picker */
  description: string;
}

export const ANIME_SUB_STYLE_META: Record<AnimeSubStyle, AnimeSubStyleMeta> = {
  shonen: {
    value: "shonen",
    label: "Shōnen",
    description: "High-energy action lines, bold shadows, dramatic expressions",
  },
  shojo: {
    value: "shojo",
    label: "Shōjo",
    description: "Soft pastels, flowing hair, sparkle highlights and roses",
  },
  chibi: {
    value: "chibi",
    label: "Chibi",
    description: "Oversized heads, tiny bodies, exaggerated cute expressions",
  },
  mecha: {
    value: "mecha",
    label: "Mecha",
    description: "Hard-edge geometry, metallic shading, cockpit HUD overlays",
  },
  "ghibli-inspired": {
    value: "ghibli-inspired",
    label: "Ghibli-inspired",
    description: "Painterly watercolour bases with warm light and nature tones",
  },
};

// ─── Outline thickness ────────────────────────────────────────────────────────

export const OUTLINE_THICKNESSES = ["thin", "medium", "bold"] as const;
export type OutlineThickness = (typeof OUTLINE_THICKNESSES)[number];

export interface OutlineThicknessMeta {
  value: OutlineThickness;
  label: string;
}

export const OUTLINE_THICKNESS_META: Record<OutlineThickness, OutlineThicknessMeta> = {
  thin: { value: "thin", label: "Thin" },
  medium: { value: "medium", label: "Medium" },
  bold: { value: "bold", label: "Bold" },
};

// ─── Background style ─────────────────────────────────────────────────────────

export const BACKGROUND_STYLES = ["original", "painted", "cel-shaded"] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

export interface BackgroundStyleMeta {
  value: BackgroundStyle;
  label: string;
  description: string;
}

export const BACKGROUND_STYLE_META: Record<BackgroundStyle, BackgroundStyleMeta> = {
  original: {
    value: "original",
    label: "Original",
    description: "Keep the source background as-is",
  },
  painted: {
    value: "painted",
    label: "Painted",
    description: "Loose brush strokes, painterly texture",
  },
  "cel-shaded": {
    value: "cel-shaded",
    label: "Cel-shaded",
    description: "Flat colour fills with hard toon-shader edges",
  },
};

// ─── Composed options object ──────────────────────────────────────────────────

/**
 * All tuning knobs for an anime transformation.
 * Sent as `transformOptions` in the dispatch payload.
 */
export interface AnimeTransformOptions {
  /** Which anime sub-genre to target. */
  subStyle: AnimeSubStyle;
  /**
   * Color palette intensity, 0–100.
   * 0 = desaturated / muted, 100 = hyper-vivid.
   */
  colorIntensity: number;
  /** Outline stroke weight. */
  outlineThickness: OutlineThickness;
  /** How the background should be rendered. */
  backgroundStyle: BackgroundStyle;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_ANIME_OPTIONS: AnimeTransformOptions = {
  subStyle: "shonen",
  colorIntensity: 70,
  outlineThickness: "medium",
  backgroundStyle: "cel-shaded",
};

// ─── Validation ───────────────────────────────────────────────────────────────

export interface AnimeOptionsValidationResult {
  valid: boolean;
  errors: string[];
  /** Sanitised options — only present when valid === true */
  data?: AnimeTransformOptions;
}

/**
 * Validate and coerce an arbitrary object into `AnimeTransformOptions`.
 * Used server-side in the API routes.
 */
export function validateAnimeOptions(
  raw: unknown,
): AnimeOptionsValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["transformOptions must be an object."] };
  }

  const errors: string[] = [];
  const o = raw as Record<string, unknown>;

  // subStyle
  if (!ANIME_SUB_STYLES.includes(o.subStyle as AnimeSubStyle)) {
    errors.push(
      `transformOptions.subStyle must be one of: ${ANIME_SUB_STYLES.join(", ")}.`,
    );
  }

  // colorIntensity
  const ci = Number(o.colorIntensity);
  if (!Number.isFinite(ci) || ci < 0 || ci > 100) {
    errors.push("transformOptions.colorIntensity must be a number between 0 and 100.");
  }

  // outlineThickness
  if (!OUTLINE_THICKNESSES.includes(o.outlineThickness as OutlineThickness)) {
    errors.push(
      `transformOptions.outlineThickness must be one of: ${OUTLINE_THICKNESSES.join(", ")}.`,
    );
  }

  // backgroundStyle
  if (!BACKGROUND_STYLES.includes(o.backgroundStyle as BackgroundStyle)) {
    errors.push(
      `transformOptions.backgroundStyle must be one of: ${BACKGROUND_STYLES.join(", ")}.`,
    );
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      subStyle: o.subStyle as AnimeSubStyle,
      colorIntensity: Math.round(ci),
      outlineThickness: o.outlineThickness as OutlineThickness,
      backgroundStyle: o.backgroundStyle as BackgroundStyle,
    },
  };
}
