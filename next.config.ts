import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { validateRequiredEnv } from "./app/lib/validateEnv";
import withBundleAnalyzer from "@next/bundle-analyzer";

validateRequiredEnv();

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
  ];
}

const nextConfig: NextConfig = {
  headers: securityHeaders,
  images: {
    remotePatterns: [
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
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.clipcash.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            default: false,
            vendors: false,
            commons: {
              name: "commons",
              chunks: "all",
              minChunks: 2,
            },
          },
        },
      };
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
