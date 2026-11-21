import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

let syncCommit = "";
try {
  const metaPath = path.join(process.cwd(), "public", "sync-meta.json");
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { sourceCommit?: string };
    syncCommit = String(meta.sourceCommit ?? "").slice(0, 12);
  }
} catch {
  // optional build metadata
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  env: {
    BUILD_TIME: new Date().toISOString(), // ponytail: build time = knowledge update time, deploy rebuilds every deploy
    SYNC_COMMIT: syncCommit,
  },
  async headers() {
    return [
      {
        source: "/skills/:path*",
        headers: [
          { key: "Content-Type", value: "text/markdown; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/llms.txt",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=3600" },
        ],
      },
      {
        source: "/n",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/n/:slug*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
