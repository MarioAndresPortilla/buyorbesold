import type { MetadataRoute } from "next";
import { getBriefs } from "@/lib/briefs";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buyorbesold.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const briefs = getBriefs();
  const latest = briefs[0]?.date ? new Date(briefs[0].date) : now;

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: latest,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/dashboard`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/briefings`,
      lastModified: latest,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/newsletter`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const briefRoutes: MetadataRoute.Sitemap = briefs.map((b) => ({
    url: `${SITE_URL}/briefings/${b.slug}`,
    lastModified: new Date(b.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...briefRoutes];
}
