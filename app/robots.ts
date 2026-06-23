import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/earnings",
          "/projects",
          "/vault",
          "/clips",
          "/onboarding",
          "/platforms",
          "/api",
        ],
      },
    ],
    sitemap: "https://clipcash.ai/sitemap.xml",
  };
}
