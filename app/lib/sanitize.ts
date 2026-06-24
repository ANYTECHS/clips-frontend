import DOMPurify from "dompurify";

/**
 * Sanitizes a string to prevent XSS attacks using DOMPurify.
 * On the server (no DOM), returns the input unchanged — output is
 * never rendered as raw HTML server-side, so this is safe.
 * Call-sites that render user content must be client components.
 */
export function sanitize(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined") return input;
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
