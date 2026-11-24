import crypto from "node:crypto";
import { checkRateLimit, MAX_BODY_BYTES, normalizeRestAudience, runVerifyRestQuery } from "@/lib/mcp-engine";
import { syncCommit } from "@/lib/vault";

export const dynamic = "force-dynamic";

const CORS_BASE: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

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

function asStringArray(val: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const items = val
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length ? items : undefined;
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_BASE });
}

export async function GET(req: Request): Promise<Response> {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { ...CORS_BASE, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const audience = normalizeRestAudience(url.searchParams.get("audience"), "user");
  const menus = splitCsv(url.searchParams.get("menus"))?.slice(0, 50);
  const tables = splitCsv(url.searchParams.get("tables"))?.slice(0, 50);
  const columns = splitCsv(url.searchParams.get("columns"))?.slice(0, 100);

  if (!menus?.length && !tables?.length && !columns?.length) {
    return Response.json(
      { ok: false, error: "Provide at least one of ?menus=, ?tables=, or ?columns=" },
      { status: 400, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }

  const result = runVerifyRestQuery({ menus, tables, columns, audience });
  const body = JSON.stringify(result);
  const etag = `"bcverify-${syncCommit || "local"}-${crypto.createHash("sha256").update(body).digest("hex").slice(0, 12)}"`;
  const cacheControl = "public, max-age=120, s-maxage=300, stale-while-revalidate=600";

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...CORS_BASE, ETag: etag, "Cache-Control": cacheControl } });
  }

  return new Response(body, {
    status: 200,
    headers: {
      ...CORS_BASE,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      ETag: etag,
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { ...CORS_BASE, "Retry-After": String(rl.retryAfterSec), "Cache-Control": "no-store" } },
    );
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Request body too large (max 32 KB)." },
      { status: 413, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return Response.json(
      { ok: false, error: "Failed to read request body." },
      { status: 400, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "Request body too large (max 32 KB)." },
      { status: 413, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    const val = JSON.parse(rawText);
    if (!val || typeof val !== "object" || Array.isArray(val)) throw new Error("expected object");
    parsed = val as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body: expected an object with menus, tables, columns, and optional audience." },
      { status: 400, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }

  const audience = normalizeRestAudience(typeof parsed.audience === "string" ? parsed.audience : null, "user");
  const menus = asStringArray(parsed.menus, 50);
  const tables = asStringArray(parsed.tables, 50);
  const columns = asStringArray(parsed.columns, 100);

  if (!menus?.length && !tables?.length && !columns?.length) {
    return Response.json(
      { ok: false, error: "Provide at least one non-empty array: menus, tables, or columns." },
      { status: 400, headers: { ...CORS_BASE, "Cache-Control": "no-store" } },
    );
  }

  const result = runVerifyRestQuery({ menus, tables, columns, audience });
  return Response.json(result, {
    status: 200,
    headers: {
      ...CORS_BASE,
      "Cache-Control": "no-store",
    },
  });
}
