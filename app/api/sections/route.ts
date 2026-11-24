import crypto from "node:crypto";
import { checkRateLimit, normalizeRestAudience, runSectionsRestQuery } from "@/lib/mcp-engine";
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
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 15 ? Math.floor(limitParam) : 5;
  const maxCharsParam = Number(url.searchParams.get("max_chars") ?? "");
  const maxChars =
    Number.isFinite(maxCharsParam) && maxCharsParam >= 200 && maxCharsParam <= 6000 ? Math.floor(maxCharsParam) : 1200;

  const result = runSectionsRestQuery({
    q: url.searchParams.get("q") ?? undefined,
    audience,
    limit,
    maxChars,
  });

  const body = JSON.stringify(result);
  const { ms: _ms, ...stable } = result;
  const etag = `"bcsec-${syncCommit || "local"}-${crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 12)}"`;
  const cacheControl = result.ok
    ? "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
    : "no-store";

  if (result.ok && req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl, "Access-Control-Allow-Origin": "*" } });
  }

  return new Response(body, {
    status: result.ok ? 200 : 400,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ...(result.ok ? { ETag: etag } : {}),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
