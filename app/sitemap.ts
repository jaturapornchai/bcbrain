import type { MetadataRoute } from "next";
import { listVaultRows } from "@/lib/vault";

const BASE = "https://brain.bcsmethai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(process.env.BUILD_TIME ?? Date.now());
  return [
    { url: `${BASE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/n`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    ...listVaultRows("all").map((n) => ({
      url: `${BASE}/n/${encodeURIComponent(n.slug)}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
