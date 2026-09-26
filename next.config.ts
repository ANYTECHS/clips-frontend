import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { validateRequiredEnv } from "./app/lib/validateEnv";
import withBundleAnalyzer from "@next/bundle-analyzer";

validateRequiredEnv();

/** CDN origin for static assets. Undefined disables the prefix (dev/test). */
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.replace(/\/+$/, "") || undefined;

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const ANALYTICS_ENABLED = ["ga4", "plausible"].includes(
  (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "").toLowerCase()
);

const CSP_REPORT_URI = "/api/csp-report";

function buildCsp(): string {
  const scriptSrc = ["'self'"];
  if (ANALYTICS_ENABLED) {
    scriptSrc.push("https://www.googletagmanager.com", "https://plausible.io");
  }

  const connectSrc = [
    "'self'",
    "https://horizon-testnet.stellar.org",
    "https://horizon.stellar.org",
    "https://api.coingecko.com",
  ];
  if (ANALYTICS_ENABLED) {
    connectSrc.push("https://www.google-analytics.com", "https://plausible.io");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "connect-src": connectSrc,
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://api.dicebear.com",
      "https://images.unsplash.com",
      "https://*.cloudfront.net",
      "https://*.amazonaws.com",
      "https://*.cloudflarestorage.com",
      "https://cdn.clipcash.dev",
      "https://lh3.googleusercontent.com",
      "https://avatars.githubusercontent.com"
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "frame-ancestors": ["'none'"],
    // Both enforcing and report-only policies share the same report sink.
    "report-uri": [CSP_REPORT_URI],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * Staging uses Report-Only so violations are logged without breaking the UI.
 * All other environments enforce the policy.
 * See docs/SECURITY.md — "CSP rollout (report-only → enforce)".
 */
function cspHeader(): { key: string; value: string } {
  const isStaging = process.env.NEXT_PUBLIC_ENVIRONMENT === "staging";
  return {
    key: isStaging
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    value: buildCsp(),
  };
}

async function securityHeaders() {
  return [
    {
      source: "/:path*",
      headers: [
        cspHeader(),
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
    // Static build artefacts — content-hashed, safe to cache for a year.
    {
      source: "/_next/static/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    // Public folder media — not content-hashed but rarely changes.
    {
      source: "/:path*\\.(ico|png|jpg|jpeg|gif|svg|webp|avif|woff|woff2|ttf|otf|eot)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ],
    },
    // Service worker - always revalidate
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    // API responses with conditional requests support
    {
      source: "/api/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=60, stale-while-revalidate=300",
        },
        // Enable ETag-based conditional requests for cache revalidation
        { key: "Vary", value: "Accept-Encoding" },
      ],
    },
    // HTML pages - must revalidate
    {
      source: "/:path*\\.html",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  // Produces a self-contained `/.next/standalone` directory that includes
  // only the files needed to run `node server.js` in production. Required
  // by deploy/Dockerfile for Fly.io / Kubernetes / Render deployments.
  // Vercel ignores this option — it uses its own build output format.
  output: "standalone",

  // Route static build assets through the CDN when configured.
  // In development (NEXT_PUBLIC_CDN_URL unset) this is undefined and Next.js
  // serves assets from the app origin as normal.
  assetPrefix: CDN_URL,
  headers: securityHeaders,
  images: {
    remotePatterns: [
      // Dicebear avatar SVGs (social proof, onboarding)
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      // AWS CloudFront CDN distributions
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      // AWS S3 buckets (direct and region-specific)
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Cloudflare R2 (S3-compatible storage alternative)
      {
        protocol: 'https',
        hostname: '**.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      // GCS via S3 interop (storage.googleapis.com/bucket-name/…)
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      // App CDN
      {
        protocol: 'https',
        hostname: 'cdn.clipcash.dev',
        port: '',
        pathname: '/**',
      },
      // Google OAuth avatar (lh3 = Google's image CDN)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      // GitHub OAuth avatar
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
    // Allow Next.js to serve and optimise SVGs from the configured remote
    // patterns above. Required for Dicebear which returns SVG content.
    // dangerouslyAllowSVG is safe here because all remote patterns are
    // locked to trusted hostnames above — no arbitrary user-supplied SVG
    // from untrusted origins reaches the image optimizer.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 24-hour minimum CDN cache for optimized images.
    // The previous value of 60 s caused the optimizer to be hammered on
    // every request in production since CDN TTL < typical cache lifetime.
    minimumCacheTTL: 86400,
  },
  /**
   * Rewrites barrel imports (`import { X } from "lucide-react"`) into deep
   * imports of just the modules actually used. lucide-react is imported in 60+
   * files here and its barrel re-exports every icon in the library, so without
   * this the whole icon set is walked on every build and a lot of it survives
   * into the client bundle.
   */
  experimental: {
    optimizePackageImports: [
      "lucide-react", 
      "@stellar/stellar-sdk", 
      "zod",
      "dompurify",
      "zustand",
    ],
  },
  
  // Production-only optimizations for JavaScript parsing performance (#880)
  ...(process.env.NODE_ENV === "production" && {
    // Enable SWC minification with aggressive optimizations
    swcMinify: true,
    compiler: {
      // Remove console.* in production except errors
      removeConsole: {
        exclude: ["error", "warn"],
      },
    },
  }),
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Production-specific optimizations (#880)
      if (!dev) {
        config.optimization = {
          ...config.optimization,
          // Split vendor bundles for better caching
          splitChunks: {
            ...(typeof config.optimization?.splitChunks === "object"
              ? config.optimization.splitChunks
              : {}),
            chunks: "all",
            cacheGroups: {
              ...(typeof config.optimization?.splitChunks === "object"
                ? config.optimization.splitChunks.cacheGroups
                : {}),
              // Framework chunk (React, Next.js core)
              framework: {
                name: "framework",
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
                priority: 40,
                reuseExistingChunk: true,
              },
              // Large libraries that change infrequently
              lib: {
                test: /[\\/]node_modules[\\/]/,
                name(module: any) {
                  // Group by package name for stable chunk names
                  const packageName = module.context?.match(
                    /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                  )?.[1];
                  return `lib.${packageName?.replace("@", "")}`;
                },
                priority: 30,
                minChunks: 1,
                reuseExistingChunk: true,
              },
              // Shared commons across pages
              commons: {
                name: "commons",
                chunks: "all",
                minChunks: 2,
                priority: 20,
                reuseExistingChunk: true,
              },
            },
          },
          // Module concatenation (scope hoisting) for smaller bundles
          concatenateModules: true,
          // Use deterministic module IDs for better long-term caching
          moduleIds: "deterministic",
          // Tree shake more aggressively
          usedExports: true,
          sideEffects: true,
        };
      } else {
        // Development: simpler splitting for faster builds
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            ...(typeof config.optimization?.splitChunks === "object"
              ? config.optimization.splitChunks
              : {}),
            chunks: "all",
            cacheGroups: {
              ...(typeof config.optimization?.splitChunks === "object"
                ? config.optimization.splitChunks.cacheGroups
                : {}),
              commons: {
                name: "commons",
                chunks: "all",
                minChunks: 2,
                priority: -10,
                reuseExistingChunk: true,
              },
            },
          },
        };
      }
    }
    return config;
  },
};

export default withSentryConfig(withAnalyzer(nextConfig), {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "your-org",
  project: "your-project",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // automaticVercelMonitors: true,
});
