import { getVaultPackGzip, syncCommit } from "@/lib/vault";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const pack = getVaultPackGzip();
  const baseHeaders: Record<string, string> = {
    ETag: pack.etag,
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    "Access-Control-Allow-Origin": "*",
  };
  if (req.headers.get("if-none-match") === pack.etag) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }
  return new Response(new Uint8Array(pack.gz), {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Type": "application/gzip",
      "Content-Disposition": 'inline; filename="bcbrain-vault-pack.json.gz"',
      "Content-Length": String(pack.gz.length),
      "X-BCBrain-Notes": String(pack.noteCount),
      "X-BCBrain-Commit": syncCommit || "local",
    },
  });
}
