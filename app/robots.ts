import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/settings",
          "/earnings",
          "/vault",
          "/projects",
          "/clips",
          "/activity",
          "/wallet",
          "/platforms",
          "/multisig",
          "/recovery",
          "/onboarding",
          "/api",
        ],
      },
    ],
    sitemap: "https://clipcash.ai/sitemap.xml",
  };
}
