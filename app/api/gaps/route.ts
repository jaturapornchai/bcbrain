import { checkRateLimit, runGapsRestQuery } from "@/lib/mcp-engine";

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
  const limitParam = Number(url.searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam >= 1 && limitParam <= 256 ? Math.floor(limitParam) : 50;

  return Response.json(runGapsRestQuery(limit), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
