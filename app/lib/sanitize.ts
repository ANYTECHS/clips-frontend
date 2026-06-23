/**
 * Sanitizes a string to prevent XSS attacks by stripping HTML tags 
 * and script content. This should be used before rendering any
 * user-supplied or API-supplied content into the DOM.
 */
export function sanitize(input: string): string {
  if (!input) return '';

  // Basic HTML stripping
  // In a more complex scenario, we would use DOMPurify
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[&<>"']/g, (m) => { // Escape special characters
      const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return map[m];
    })
    .trim();
}
