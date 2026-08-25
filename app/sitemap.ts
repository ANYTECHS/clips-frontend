import type { MetadataRoute } from "next";
import { metadata } from "@/app/layout";

/**
 * Public, indexable pages only. Everything behind auth is excluded here and
 * disallowed in `app/robots.ts` — the two files are meant to stay in agreement.
 *
 * Individual share links (`/share/[shareId]`) are crawlable but deliberately
 * not enumerated: they are unlisted by design, and listing them would hand
 * every shared clip to crawlers. `/share` is included so the section is
 * discoverable without leaking share ids.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    metadata.metadataBase?.toString().replace(/\/$/, "") || "https://clipcash.ai";

  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/share`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
