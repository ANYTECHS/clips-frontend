import type { MetadataRoute } from "next";

/**
 * Every page under `app/(dashboard)` sits behind auth, so none of it should be
 * crawled. It has to be an explicit list rather than one prefix: a route group
 * does not appear in the URL, so `app/(dashboard)/billing` is served at
 * `/billing` and there is no shared path segment to disallow.
 *
 * When adding a page under `app/(dashboard)`, add its path here too.
 */
const DASHBOARD_ROUTES = [
  "/activity",
  "/analytics",
  "/billing",
  "/dashboard",
  "/earnings",
  "/multisig",
  "/platforms",
  "/projects",
  "/referral",
  "/settings",
  "/transform",
  "/vault",
  "/wallet",
];

/** Authenticated, transactional, or non-indexable routes outside that group. */
const OTHER_PRIVATE_ROUTES = [
  "/clips",
  "/recovery",
  "/onboarding",
  "/upload",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/nft-demo",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/explore",
          // Share links are the one authenticated-adjacent surface meant to be
          // public — they are how a clip reaches social media.
          "/share/",
        ],
        disallow: [
          ...DASHBOARD_ROUTES,
          ...OTHER_PRIVATE_ROUTES,
          // Trailing slash so nested handlers are covered, not just `/api`.
          "/api/",
        ],
      },
    ],
    sitemap: "https://clipcash.ai/sitemap.xml",
  };
}
