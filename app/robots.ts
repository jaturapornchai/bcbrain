import type { MetadataRoute } from "next";

const CRAWLERS = [
  "*",
  "Googlebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
];

// everything is public; /mcp is an API endpoint, not a page
export default function robots(): MetadataRoute.Robots {
  return {
    rules: CRAWLERS.map((userAgent) => ({
      userAgent,
      allow: "/",
      disallow: ["/mcp"],
    })),
    sitemap: "https://brain.bcsmethai.com/sitemap.xml",
  };
}
