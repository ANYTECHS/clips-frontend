/**
 * FontPreload Component
 * 
 * Renders resource hints for font preloading to minimize font-related layout shifts.
 * - Preconnect: Establishes early connection to Google Fonts CDN
 * - DNS-prefetch: Fallback for older browsers
 * - Font preload: Explicit preload of critical fonts before CSS parsing
 * 
 * This component should be placed in the root layout head to ensure fonts
 * load with maximum priority.
 * 
 * See: https://web.dev/articles/preload-responsive-images
 */

export default function FontPreload() {
  return (
    <>
      {/* Preconnect to Google Fonts to establish early TLS handshake */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
        crossOrigin="anonymous"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      
      {/* DNS-prefetch fallback for older browsers */}
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
      
      {/* 
        Font preload is handled by Next.js through the Inter() configuration
        with preload: true. These hints are auto-injected into the head.
      */}
    </>
  );
}
