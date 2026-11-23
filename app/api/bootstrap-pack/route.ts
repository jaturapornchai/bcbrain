import { getBootstrapPack } from "@/lib/vault";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const aud = url.searchParams.get("audience") === "dev" ? "dev" : "user";
  const fmt = url.searchParams.get("format") === "json" ? "json" : "text";
  const pack = getBootstrapPack(aud);
  const etag = fmt === "json" ? pack.etag.replace(/"$/, '-json"') : pack.etag;
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*",
  };
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(
    fmt === "json" ? JSON.stringify({ audience: aud, chars: pack.chars, etag, text: pack.text }) : pack.text,
    {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": fmt === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
      },
    },
  );
}
