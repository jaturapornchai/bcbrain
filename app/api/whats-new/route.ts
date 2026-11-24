import crypto from "node:crypto";
import { checkRateLimit, normalizeRestAudience, runWhatsNewRestQuery } from "@/lib/mcp-engine";
import { syncCommit } from "@/lib/vault";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

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
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec), "Access-Control-Allow-Origin": "*" } },
    );
  }

  const url = new URL(req.url);
  const audience = normalizeRestAudience(url.searchParams.get("audience"), "user");
  const daysParam = Number(url.searchParams.get("days") ?? "");
  const days = Number.isFinite(daysParam) && daysParam >= 1 && daysParam <= 365 ? Math.floor(daysParam) : 7;
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 50 ? Math.floor(limitParam) : 20;

  const result = runWhatsNewRestQuery({ days, audience, limit });
  const body = JSON.stringify(result);
  const { ms: _ms, ...stable } = result;
  const etag = `"bcnew-${syncCommit || "local"}-${crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 12)}"`;
  const cacheControl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600";

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl, "Access-Control-Allow-Origin": "*" } });
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
