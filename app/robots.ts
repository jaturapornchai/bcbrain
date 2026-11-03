import type { MetadataRoute } from "next";

// everything is public; /mcp is an API endpoint, not a page
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/mcp"] },
    sitemap: "https://brain.bcsmethai.com/sitemap.xml",
  };
}
