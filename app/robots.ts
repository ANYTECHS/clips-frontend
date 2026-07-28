import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/analytics",
          "/billing",
          "/referral",
          "/settings",
          "/earnings",
          "/vault",
          "/projects",
          "/activity",
          "/wallet",
          "/platforms",
          "/multisig",
          "/transform",
          "/recovery",
          "/onboarding",
          "/forgot-password",
          "/reset-password",
          "/api/*",
          "/api",
        ],
      },
    ],
    sitemap: "https://clipcash.ai/sitemap.xml",
  };
}
