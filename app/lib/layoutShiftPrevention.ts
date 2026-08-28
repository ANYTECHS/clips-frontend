/**
 * Layout Shift Prevention Utilities (#873)
 *
 * Tools for identifying and preventing Cumulative Layout Shift (CLS) issues:
 * - Aspect ratio preservation utilities
 * - Space reservation helpers for dynamic content
 * - CLS measurement and debugging tools
 * - Layout shift attribution tracking
 *
 * Target: CLS < 0.1 (Good rating per Web Vitals)
 */

import { logger } from "./logger";

// ─── Aspect Ratio Utilities ──────────────────────────────────────────────────

/**
 * Common aspect ratios used throughout the app.
 * Exported as constants to ensure consistency.
 */
export const ASPECT_RATIOS = {
  /** Standard video (16:9) */
  VIDEO: 16 / 9,
  /** Vertical/portrait video (9:16) - TikTok, Reels, Shorts */
  PORTRAIT: 9 / 16,
  /** Square (1:1) - Instagram posts */
  SQUARE: 1,
  /** Widescreen (21:9) */
  ULTRAWIDE: 21 / 9,
  /** Classic photo (4:3) */
  CLASSIC: 4 / 3,
  /** Thumbnail (3:2) */
  THUMBNAIL: 3 / 2,
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

/**
 * Generate CSS padding-bottom percentage for aspect ratio boxes.
 * 
 * This creates the classic "padding-bottom hack" to reserve space before
 * content loads, preventing layout shift.
 * 
 * @example
 * ```tsx
 * <div style={{ paddingBottom: aspectRatioPadding(ASPECT_RATIOS.VIDEO) }}>
 *   <Image fill ... />
 * </div>
 * ```
 */
export function aspectRatioPadding(ratio: number): string {
  return `${(1 / ratio) * 100}%`;
}

/**
 * Get Tailwind-compatible aspect-ratio class for common ratios.
 * Falls back to inline style for custom ratios.
 * 
 * @example
 * ```tsx
 * <div className={aspectRatioClass(ASPECT_RATIOS.VIDEO)}>
 *   <Image fill ... />
 * </div>
 * ```
 */
export function aspectRatioClass(ratio: number): string {
  // Map to Tailwind's built-in aspect ratio utilities
  if (ratio === ASPECT_RATIOS.VIDEO) return "aspect-video";
  if (ratio === ASPECT_RATIOS.SQUARE) return "aspect-square";
  if (ratio === ASPECT_RATIOS.PORTRAIT) return "aspect-[9/16]";
  
  // For custom ratios, return a data attribute that can be styled
  return `aspect-[${Math.round(ratio * 100)}/100]`;
}

/**
 * Calculate dimensions that preserve aspect ratio within max bounds.
 * Useful for dynamically sizing containers while preventing shifts.
 */
export function constrainToAspectRatio(
  maxWidth: number,
  maxHeight: number,
  aspectRatio: number
): { width: number; height: number } {
  const constrainedByWidth = {
    width: maxWidth,
    height: maxWidth / aspectRatio,
  };

  const constrainedByHeight = {
    width: maxHeight * aspectRatio,
    height: maxHeight,
  };

  // Return whichever constraint fits within both bounds
  if (constrainedByWidth.height <= maxHeight) {
    return constrainedByWidth;
  }
  return constrainedByHeight;
}

// ─── Space Reservation ────────────────────────────────────────────────────────

/**
 * Minimum heights for skeleton states that match actual content.
 * Prevents shift when real content loads.
 */
export const RESERVED_HEIGHTS = {
  /** Stat card with icon, value, and label */
  STAT_CARD: "144px",
  /** Chart container with legend */
  CHART: "300px",
  /** Project card with thumbnail and metadata */
  PROJECT_CARD: "320px",
  /** Clip card in grid */
  CLIP_CARD: "280px",
  /** Table row */
  TABLE_ROW: "56px",
  /** Modal header */
  MODAL_HEADER: "80px",
  /** Navigation bar */
  NAV_BAR: "72px",
  /** Button group */
  BUTTON_GROUP: "48px",
  /** Form field */
  FORM_FIELD: "76px",
} as const;

/**
 * Generate style object for reserving minimum height.
 * Use this on skeleton/loading containers to prevent shift.
 */
export function reserveHeight(height: string | number): React.CSSProperties {
  return {
    minHeight: typeof height === "number" ? `${height}px` : height,
  };
}

/**
 * Reserve space for grid items with known aspect ratio and column count.
 * Prevents shift during initial grid load.
 */
export function reserveGridSpace(
  itemCount: number,
  columns: number,
  aspectRatio: number,
  gap: number = 24
): React.CSSProperties {
  const rows = Math.ceil(itemCount / columns);
  // Approximate height: (container width / columns) / aspectRatio * rows + gaps
  // This is a best-effort estimate; actual height will be close enough to prevent major shift
  const estimatedHeight = `calc((100vw / ${columns}) / ${aspectRatio} * ${rows} + ${gap * (rows - 1)}px)`;
  
  return {
    minHeight: estimatedHeight,
  };
}

// ─── CLS Measurement & Debugging ──────────────────────────────────────────────

export interface LayoutShiftEntry {
  /** Shift score contribution (0.0 - 1.0+) */
  value: number;
  /** Whether the shift had recent user input (within 500ms) */
  hadRecentInput: boolean;
  /** Timestamp of the shift */
  startTime: number;
  /** List of DOM nodes that shifted */
  sources?: Array<{
    node: Node;
    previousRect: DOMRectReadOnly;
    currentRect: DOMRectReadOnly;
  }>;
}

/**
 * Track layout shifts and identify the worst offenders.
 * Useful for debugging CLS issues in development.
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   const stop = trackLayoutShifts((entries) => {
 *     console.log('Layout shifts detected:', entries);
 *   });
 *   return stop;
 * }, []);
 * ```
 */
export function trackLayoutShifts(
  onShift: (entries: LayoutShiftEntry[]) => void
): () => void {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as Array<any>;
      const shifts: LayoutShiftEntry[] = entries
        .filter((entry) => entry.entryType === "layout-shift")
        .map((entry) => ({
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
          startTime: entry.startTime,
          sources: entry.sources?.map((source: any) => ({
            node: source.node,
            previousRect: source.previousRect,
            currentRect: source.currentRect,
          })),
        }));

      if (shifts.length > 0) {
        onShift(shifts);
      }
    });

    observer.observe({ type: "layout-shift", buffered: true });

    return () => observer.disconnect();
  } catch (err) {
    logger.warn("[layoutShiftPrevention] Failed to observe layout shifts", err);
    return () => {};
  }
}

/**
 * Log layout shifts to console during development.
 * Includes attribution to identify which elements caused the shift.
 */
export function debugLayoutShifts(): () => void {
  if (process.env.NODE_ENV !== "development") {
    return () => {};
  }

  return trackLayoutShifts((entries) => {
    entries.forEach((entry) => {
      if (entry.hadRecentInput) {
        // Shifts within 500ms of user input don't count toward CLS
        return;
      }

      logger.warn(`[CLS] Layout shift detected: ${entry.value.toFixed(4)}`, {
        startTime: entry.startTime,
        sources: entry.sources?.map((s) => ({
          node: s.node.nodeName,
          previousSize: `${s.previousRect.width}x${s.previousRect.height}`,
          currentSize: `${s.currentRect.width}x${s.currentRect.height}`,
        })),
      });

      // Highlight shifted elements in development
      if (entry.sources && typeof document !== "undefined") {
        entry.sources.forEach((source) => {
          if (source.node instanceof Element) {
            source.node.classList.add("debug-layout-shift");
            setTimeout(() => {
              source.node.classList?.remove("debug-layout-shift");
            }, 2000);
          }
        });
      }
    });
  });
}

/**
 * Calculate CLS score from layout shift entries.
 * Groups shifts into sessions (max 5s gap, max 1s session duration).
 * Returns the session with the highest score.
 * 
 * Implements the windowed CLS algorithm from Web Vitals.
 */
export function calculateCLS(entries: LayoutShiftEntry[]): number {
  const MAX_SESSION_GAP_MS = 1000;
  const MAX_SESSION_DURATION_MS = 5000;

  let sessionValue = 0;
  let sessionStartTime = 0;
  let maxSessionValue = 0;
  let previousShiftTime = 0;

  for (const entry of entries) {
    // Skip shifts with recent input (they don't count toward CLS)
    if (entry.hadRecentInput) continue;

    const timeSinceLastShift = entry.startTime - previousShiftTime;
    const sessionDuration = entry.startTime - sessionStartTime;

    // Start new session if gap is too large or session too long
    if (
      timeSinceLastShift > MAX_SESSION_GAP_MS ||
      sessionDuration > MAX_SESSION_DURATION_MS
    ) {
      maxSessionValue = Math.max(maxSessionValue, sessionValue);
      sessionValue = 0;
      sessionStartTime = entry.startTime;
    }

    sessionValue += entry.value;
    previousShiftTime = entry.startTime;
  }

  return Math.max(maxSessionValue, sessionValue);
}

// ─── Preload Utilities ────────────────────────────────────────────────────────

/**
 * Preload critical images to prevent shift during initial render.
 * Use for above-the-fold images that should load before First Contentful Paint.
 * 
 * @example
 * ```tsx
 * useEffect(() => {
 *   preloadImage('/hero-image.jpg');
 * }, []);
 * ```
 */
export function preloadImage(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Preload multiple images in parallel.
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(srcs.map(preloadImage));
}

/**
 * Get image dimensions without loading the full image.
 * Useful for setting explicit width/height to prevent shift.
 */
export function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("getImageDimensions requires window"));
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = src;
  });
}
