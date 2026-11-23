import {
  checkRateLimit,
  CORS_HEADERS,
  handleJsonRpcPayload,
  JSON_HEADERS,
  MAX_BODY_BYTES,
} from "@/lib/mcp-engine";

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
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(): Promise<Response> {
  return new Response(
    '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Method not allowed: stateless MCP server uses POST /mcp."}}',
    { status: 405, headers: { ...JSON_HEADERS, Allow: "POST, DELETE, OPTIONS" } },
  );
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.ok) {
    return new Response(
      '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Rate limit exceeded (max 300 requests/minute). Please retry shortly."}}',
      { status: 429, headers: { ...JSON_HEADERS, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    return new Response(
      '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}',
      { status: 413, headers: JSON_HEADERS },
    );
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return new Response(
      '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Failed to read request body."}}',
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const out = handleJsonRpcPayload(rawText);
  if (out.body === null) return new Response(null, { status: out.status, headers: CORS_HEADERS });
  return new Response(out.body, { status: out.status, headers: JSON_HEADERS });
}
