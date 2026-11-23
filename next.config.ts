import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  // Opens the treemap in your browser automatically when ANALYZE=true
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Backend stores video thumbnails and clip thumbnails on Cloudinary
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        // YouTube video thumbnails
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        // Google OAuth user avatar URLs
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        // Backend Render host
        protocol: "https",
        hostname: "clipcash-api.onrender.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
    ],
  },
  async rewrites() {
    const apiBase = (process.env.API_URL || 'https://clipcash-api.onrender.com').replace(/\/+$/, '');
    return [
      // Issue #1395 — Versioned API namespace: public API routes live under
      // /api/v1/*; unversioned paths are deprecated in favour of the versioned
      // namespace going forward.
      { source: '/api/v1/:path*', destination: `${apiBase}/api/v1/:path*` },
    ];
  },
  async headers() {
    // Issue #1369 — HSTS is only meaningful over HTTPS, so it is emitted in
    // production builds only (dev/staging may be served over plain HTTP).
    const isProduction = process.env.NODE_ENV === "production";
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(isProduction
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains; preload",
            },
          ]
        : []),
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withBundleAnalyzer(nextConfig);
