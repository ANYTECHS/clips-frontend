"use client";

import { useEffect } from "react";

/**
 * FontPreload component preloads fonts to prevent FOIT/FOUT layout shift.
 *
 * This component preloads critical fonts before they're needed, ensuring
 * text renders immediately without a flash of invisible text (FOIT) or
 * flash of unstyled text (FOUT), both of which can cause layout shift.
 *
 * @example
 * ```tsx
 * <FontPreload href="/fonts/inter.woff2" as="font" type="font/woff2" />
 * ```
 */
export function FontPreload({
  href,
  as = "font",
  type,
  crossOrigin = "anonymous",
}: {
  href: string;
  as?: string;
  type?: string;
  crossOrigin?: string;
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    if (crossOrigin) link.crossOrigin = crossOrigin;

    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [href, as, type, crossOrigin]);

  return null;
}

/**
 * Preload multiple fonts at once.
 */
export function FontPreloadGroup({
  fonts,
}: {
  fonts: Array<{ href: string; type?: string }>;
}) {
  return (
    <>
      {fonts.map((font, index) => (
        <FontPreload key={index} href={font.href} type={font.type} />
      ))}
    </>
  );
}
