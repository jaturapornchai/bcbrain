import crypto from "node:crypto";
import { checkRateLimit, normalizeRestAudience, runFactsRestQuery } from "@/lib/mcp-engine";
import { syncCommit, type FactKind } from "@/lib/vault";

export const dynamic = "force-dynamic";

const VALID_KINDS = new Set<FactKind>(["menu", "rule", "limit", "error", "formula"]);

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function splitCsv(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
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
  const q = url.searchParams.get("q") ?? undefined;
  const slugs = splitCsv(url.searchParams.get("slugs"))?.slice(0, 10);
  const rawKinds = splitCsv(url.searchParams.get("kinds"));
  const kinds = rawKinds
    ?.map((k) => k.toLowerCase())
    .filter((k): k is FactKind => VALID_KINDS.has(k as FactKind));
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 50 ? Math.floor(limitParam) : 20;

  const result = runFactsRestQuery({
    q,
    slugs,
    kinds: kinds?.length ? kinds : undefined,
    audience,
    limit,
  });

  const body = JSON.stringify(result);
  const { ms: _ms, ...stable } = result;
  const etag = `"bcfacts-${syncCommit || "local"}-${crypto.createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 12)}"`;
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
