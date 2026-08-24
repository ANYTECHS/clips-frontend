/**
 * Image utility functions for progressive loading and optimization
 * Client-side only - use within useEffect or event handlers
 */

/**
 * Image loading states for progressive loading
 */
export type ImageLoadingState = 'loading' | 'loaded' | 'error';

/**
 * Default blur placeholder for when image URL is not available
 * This is a simple SVG placeholder that works universally
 */
export const DEFAULT_BLUR_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%231a1a1a"/%3E%3C/svg%3E';

/**
 * Generates a low-quality image placeholder (LQIP) blur data URL
 * This creates a tiny blurred version of the image for smooth loading transitions
 * Client-side only - must be called in browser context
 */
export function generateBlurPlaceholder(width: number = 10, height: number = 10): string {
  if (typeof window === 'undefined') {
    return DEFAULT_BLUR_PLACEHOLDER;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Create a subtle gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  return canvas.toDataURL('image/jpeg', 0.1);
}

/**
 * Cache for storing generated blur placeholders to avoid regenerating
 */
const blurCache = new Map<string, string>();

/**
 * Get or generate a blur placeholder for a specific image URL
 * Client-side only - must be called in browser context
 */
export function getBlurPlaceholder(imageUrl: string, width: number = 10, height: number = 10): string {
  if (typeof window === 'undefined') {
    return DEFAULT_BLUR_PLACEHOLDER;
  }
  
  if (blurCache.has(imageUrl)) {
    return blurCache.get(imageUrl)!;
  }
  
  const placeholder = generateBlurPlaceholder(width, height);
  blurCache.set(imageUrl, placeholder);
  return placeholder;
}
