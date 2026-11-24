import crypto from "node:crypto";
import { checkRateLimit, normalizeRestAudience, runFastRestQuery } from "@/lib/mcp-engine";
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
  const rawMode = url.searchParams.get("mode");
  const mode = rawMode === "normal" || rawMode === "fast" ? rawMode : "ultra";
  const media = url.searchParams.get("media") === "1" || url.searchParams.get("media") === "true";
  const maxCharsParam = Number(url.searchParams.get("max_chars") ?? "");
  const maxChars = Number.isFinite(maxCharsParam) && maxCharsParam >= 300 && maxCharsParam <= 4500 ? Math.floor(maxCharsParam) : undefined;
  const format = url.searchParams.get("format") === "text" ? "text" : "json";

  const result = runFastRestQuery({
    q: url.searchParams.get("q") ?? undefined,
    menu: url.searchParams.get("menu") ?? undefined,
    audience,
    mode,
    includeMedia: media,
    maxChars,
  });

  const body = format === "text" ? result.answer : JSON.stringify(result);
  const { ms: _ms, cached: _cached, ...stable } = result;
  const etagSeed = format === "text" ? result.answer : JSON.stringify(stable);
  const etag = `"bcfast-${syncCommit || "local"}-${crypto.createHash("sha256").update(etagSeed).digest("hex").slice(0, 12)}"`;
  const cacheControl = result.ok
    ? "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
    : "no-store";

  if (result.ok && req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl, "Access-Control-Allow-Origin": "*" } });
  }

  return new Response(body, {
    status: result.ok ? 200 : 400,
    headers: {
      "Content-Type": format === "text" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ...(result.ok ? { ETag: etag } : {}),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
