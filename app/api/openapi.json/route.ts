import crypto from "node:crypto";
import { getOpenApiSpec } from "@/lib/openapi";
import { syncCommit } from "@/lib/vault";

export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    },
  });
}

export async function GET(req: Request): Promise<Response> {
  const body = JSON.stringify(getOpenApiSpec());
  const etag = `"bcopenapi-${syncCommit || "local"}-${crypto.createHash("sha256").update(body).digest("hex").slice(0, 12)}"`;
  const cacheControl = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl, "Access-Control-Allow-Origin": "*" },
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ETag: etag,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
