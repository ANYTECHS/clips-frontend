/**
 * imageUtils.ts
 *
 * Shared image utilities for next/image:
 *  - Blur placeholder data URIs (static dark SVG + shimmer variant)
 *  - Typed `sizes` string constants for every responsive grid used in the app
 *  - ImageLoadingState type consumed by load/error handlers
 *
 * All exports are safe to use in both Server Components and Client Components.
 * Canvas-based helpers are guarded with `typeof window !== 'undefined'`. The
 * `*Async` variants render via OffscreenCanvas in a worker instead of the
 * main-thread canvas; see docs/offscreen-canvas-usage.md.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** States for progressive image loading (loading → loaded | error). */
export type ImageLoadingState = "loading" | "loaded" | "error";

// ─── Static blur placeholders ────────────────────────────────────────────────

/**
 * Solid dark SVG data URI — the universal fallback.
 * Works on both server and client; zero network cost; accepted by
 * next/image's `blurDataURL` prop without any additional config.
 */
export const DEFAULT_BLUR_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%231a1a1a"/%3E%3C/svg%3E';

/**
 * Shimmer-gradient blur placeholder.
 *
 * A 700×475 SVG that fades from #1a1a1a to #2a2a2a with an animated
 * shimmer sweep — visually identical to the Skeleton component but
 * embedded as a data URI so it works inside next/image's blurDataURL.
 *
 * Use this wherever you want the shimmer effect during image load instead
 * of a static dark rectangle.
 */
export const SHIMMER_BLUR_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="475">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#1a1a1a"/>
      <stop offset="50%"  stop-color="#2a2a2a"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
      <animateTransform attributeName="gradientTransform" type="translate"
        from="-1 0" to="2 0" dur="1.6s" repeatCount="indefinite"/>
    </linearGradient>
  </defs>
  <rect width="700" height="475" fill="url(#g)"/>
</svg>
`)}`;

/**
 * Solid dark placeholder for video-aspect thumbnails (16:9 ratio).
 * Identical to DEFAULT_BLUR_PLACEHOLDER but documents intent at the call site.
 */
export const VIDEO_BLUR_PLACEHOLDER = DEFAULT_BLUR_PLACEHOLDER;

/**
 * Solid dark placeholder for portrait-aspect clip thumbnails (9:16 ratio).
 */
export const PORTRAIT_BLUR_PLACEHOLDER = DEFAULT_BLUR_PLACEHOLDER;

// ─── Responsive sizes strings ────────────────────────────────────────────────
//
// These match the Tailwind grid breakpoints used across the app.
// Centralising them means a grid change only needs one edit here.
//
// Rule of thumb: the sizes string should describe the *rendered* width of the
// image at each viewport breakpoint, NOT the container width.

/**
 * 4-column grid: 1→2→3→4 columns at sm/lg/xl.
 * Used by: ClipGrid, projects/[id] clip list, ExploreFeed.
 *
 *   <640px  → 1 col  → 100vw
 *   640px+  → 2 cols → ~50vw  (gap ≈ 24px, so slightly under 50vw)
 *   1024px+ → 3 cols → ~33vw
 *   1280px+ → 4 cols → ~25vw
 */
export const SIZES_CLIP_GRID =
  "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw";

/**
 * 3-column style card grid: 1→2→3 columns at sm/md.
 * Used by: StyleCard / StylePicker.
 *
 *   <640px  → 1 col → 100vw
 *   640px+  → 2 cols → 50vw
 *   768px+  → 3 cols → 33vw
 */
export const SIZES_STYLE_GRID =
  "(max-width: 639px) 100vw, (max-width: 767px) 50vw, 33vw";

/**
 * Fixed 96×96 px thumbnail inside a card (ProjectCard).
 * Width is constant regardless of viewport — tell the browser exactly.
 */
export const SIZES_PROJECT_CARD_THUMB = "96px";

/**
 * Full-width video-aspect hero image (max-w-2xl ≈ 672px on desktop).
 *
 *   <640px  → full viewport width
 *   640px+  → capped at 672px (max-w-2xl)
 */
export const SIZES_PROJECT_HERO =
  "(max-width: 639px) 100vw, 672px";

/**
 * Small preview thumbnail in the transform progress card (80×56 px fixed).
 */
export const SIZES_TRANSFORM_THUMB = "80px";

/**
 * Full-width aspect-video preview frame.
 *
 *   <640px  → full viewport width
 *   640px+  → capped at 768px (max-w-3xl content column)
 */
export const SIZES_TRANSFORM_PREVIEW =
  "(max-width: 639px) 100vw, 768px";

/**
 * BatchTransformModal live preview (modal is max-w-2xl ≈ 672px).
 */
export const SIZES_MODAL_PREVIEW =
  "(max-width: 639px) calc(100vw - 32px), 640px";

/**
 * ClipEditorModal preview area — dynamic aspect ratio, full modal width.
 */
export const SIZES_EDITOR_PREVIEW =
  "(max-width: 639px) calc(100vw - 48px), 672px";

/**
 * Trim timeline thumbnail strip — always narrow (≤ 480px).
 */
export const SIZES_TRIM_TIMELINE = "480px";

/**
 * User avatar — small fixed-size image.
 * width/height props are already explicit; this tells the browser the
 * rendered size so it doesn't download a larger srcset variant.
 */
export const SIZES_AVATAR_SM = "40px";
export const SIZES_AVATAR_MD = "48px";

// ─── Canvas-based placeholder (client-only) ───────────────────────────────────

/**
 * Cache for storing generated blur placeholders to avoid regenerating.
 * Client-only — Map is not serialisable for RSC.
 */
const blurCache = new Map<string, string>();

/**
 * Generate a tiny gradient placeholder using Canvas.
 * Returns DEFAULT_BLUR_PLACEHOLDER when called on the server.
 *
 * NOTE: This creates a generic dark gradient, not a downsampled version
 * of the actual image. For true LQIP you would need a server-side sharp
 * transformation step at upload time. This is sufficient for skeleton-style
 * loading transitions.
 */
export function generateBlurPlaceholder(
  width = 10,
  height = 10,
): string {
  if (typeof window === "undefined") return DEFAULT_BLUR_PLACEHOLDER;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1a1a");
    gradient.addColorStop(1, "#2a2a2a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  return canvas.toDataURL("image/jpeg", 0.1);
}

/**
 * Get or generate a cached blur placeholder keyed by image URL.
 * Client-only — returns DEFAULT_BLUR_PLACEHOLDER on the server.
 */
export function getBlurPlaceholder(
  imageUrl: string,
  width = 10,
  height = 10,
): string {
  if (typeof window === "undefined") return DEFAULT_BLUR_PLACEHOLDER;
  if (blurCache.has(imageUrl)) return blurCache.get(imageUrl)!;

  const placeholder = generateBlurPlaceholder(width, height);
  blurCache.set(imageUrl, placeholder);
  return placeholder;
}

// ─── OffscreenCanvas-based placeholder (client-only, off main thread) ────────
//
// Same gradient + encode as generateBlurPlaceholder above, but run inside a
// worker via OffscreenCanvas so drawing and JPEG encoding never block the
// main thread. Falls back to the synchronous canvas implementation where
// OffscreenCanvas or Worker aren't available (Safari < 16.4, SSR, jsdom).

let blurWorker: Worker | null = null;
let blurRequestId = 0;
const pendingBlurRequests = new Map<number, (dataUrl: string) => void>();

function supportsOffscreenCanvas(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined"
  );
}

function getBlurWorker(): Worker {
  if (!blurWorker) {
    blurWorker = new Worker(new URL("../workers/blurPlaceholder.worker.ts", import.meta.url));
    blurWorker.onmessage = (event: MessageEvent<{ requestId: number; dataUrl: string }>) => {
      const resolve = pendingBlurRequests.get(event.data.requestId);
      if (!resolve) return;
      resolve(event.data.dataUrl);
      pendingBlurRequests.delete(event.data.requestId);
    };
  }
  return blurWorker;
}

/**
 * Generate a tiny gradient placeholder off the main thread using
 * OffscreenCanvas. Falls back to `generateBlurPlaceholder` (synchronous,
 * main-thread canvas) where OffscreenCanvas/Worker support is missing.
 */
export function generateBlurPlaceholderAsync(width = 10, height = 10): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(DEFAULT_BLUR_PLACEHOLDER);
  if (!supportsOffscreenCanvas()) return Promise.resolve(generateBlurPlaceholder(width, height));

  const worker = getBlurWorker();
  const requestId = ++blurRequestId;

  return new Promise((resolve) => {
    pendingBlurRequests.set(requestId, resolve);
    worker.postMessage({ requestId, width, height });
  });
}

/**
 * Get or generate a cached blur placeholder keyed by image URL, generating
 * off the main thread via `generateBlurPlaceholderAsync`.
 * Client-only — resolves to DEFAULT_BLUR_PLACEHOLDER on the server.
 */
export async function getBlurPlaceholderAsync(
  imageUrl: string,
  width = 10,
  height = 10,
): Promise<string> {
  if (typeof window === "undefined") return DEFAULT_BLUR_PLACEHOLDER;
  if (blurCache.has(imageUrl)) return blurCache.get(imageUrl)!;

  const placeholder = await generateBlurPlaceholderAsync(width, height);
  blurCache.set(imageUrl, placeholder);
  return placeholder;
}
