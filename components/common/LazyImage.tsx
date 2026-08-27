"use client";

import React, { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import { useIntersectionObserver } from "@/app/hooks/useIntersectionObserver";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/app/lib/imageUtils";

export interface LazyImageProps extends Omit<ImageProps, "onLoad" | "onError" | "placeholder" | "blurDataURL"> {
  /** Distance from the viewport at which to start loading. Default "200px". */
  rootMargin?: string;
  /** Shown while off-screen and while the image loads. Defaults to a subtle blur placeholder. */
  placeholderClassName?: string;
  /** Content shown in place of the image if it fails to load. */
  errorFallback?: React.ReactNode;
  onLoadingComplete?: () => void;
  onLoadError?: (error: unknown) => void;
}

/**
 * Image that only starts loading once it nears the viewport (via
 * `IntersectionObserver`), with a blur placeholder while off-screen/loading
 * and a graceful fallback on error.
 *
 * `next/image` already lazy-loads by default, but only defers the browser's
 * network request — the `<img>` element and its wrapping DOM still mount
 * immediately. This additionally defers mounting the image itself, which
 * matters for long below-fold grids (explore feed, clip grids, vault).
 */
export default function LazyImage({
  rootMargin = "200px",
  placeholderClassName,
  errorFallback,
  onLoadingComplete,
  onLoadError,
  className,
  alt,
  ...imageProps
}: LazyImageProps) {
  const { ref, isIntersecting } = useIntersectionObserver<HTMLDivElement>({ rootMargin, once: true });
  const [status, setStatus] = useState<"pending" | "loaded" | "error">("pending");

  return (
    <div ref={ref} className="relative w-full h-full">
      {isIntersecting && status !== "error" && (
        <Image
          {...imageProps}
          alt={alt}
          placeholder="blur"
          blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
          className={`transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
          onLoad={() => {
            setStatus("loaded");
            onLoadingComplete?.();
          }}
          onError={(error) => {
            setStatus("error");
            onLoadError?.(error);
          }}
        />
      )}

      {(!isIntersecting || status === "pending") && status !== "error" && (
        <div
          className={`absolute inset-0 animate-pulse bg-white/[0.06] ${placeholderClassName ?? ""}`}
          aria-hidden="true"
        />
      )}

      {status === "error" && (
        errorFallback ?? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/10 flex items-center justify-center">
                <ImageOff className="w-6 h-6 text-white/50" />
              </div>
              <p className="text-xs text-white/50">Image failed to load</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
