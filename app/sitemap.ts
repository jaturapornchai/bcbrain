import type { MetadataRoute } from "next";
import { vault } from "@/lib/vault";

const BASE = "https://brain.bcsmethai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/n`, changeFrequency: "weekly", priority: 0.8 },
    ...[...vault().keys()].map((slug) => ({ url: `${BASE}/n/${encodeURIComponent(slug)}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
