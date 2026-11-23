// Ultra-fast zero-Next.js raw Node HTTP sidecar for BC Brain MCP, SSE events, /api/fast, /api/bootstrap-pack & /api/vault-pack.
// Runs on 127.0.0.1:3961 behind Caddy (routes /mcp, /mcp/events, /api/fast, /api/bootstrap-pack, /api/vault-pack).
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Allow Node 22/24 native TS execution to resolve extensionless relative imports used by Next.js / tsconfig
registerHooks({
  resolve(specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: { parentURL?: string }) => unknown) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context) as { url: string; shortCircuit?: boolean };
  },
});

// Load SYNC_COMMIT from public/sync-meta.json if not already set in env
if (!process.env.SYNC_COMMIT) {
  try {
    const metaPath = path.join(process.cwd(), "public", "sync-meta.json");
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as { sourceCommit?: string; syncedAt?: string };
      if (meta.sourceCommit) process.env.SYNC_COMMIT = String(meta.sourceCommit).slice(0, 12);
      if (meta.syncedAt && !process.env.BUILD_TIME) process.env.BUILD_TIME = String(meta.syncedAt);
    }
  } catch {
    // optional
  }
}

const {
  checkRateLimit,
  CORS_HEADERS,
  handleJsonRpcPayload,
  JSON_HEADERS,
  MAX_BODY_BYTES,
  runFastRestQuery,
  SERVER_INFO,
} = await import("../lib/mcp-engine.ts");
const { recentMcpEvents, subscribeMcpEvents } = await import("../lib/mcp-events.ts");
const { getBootstrapPack, getVaultPackGzip, syncCommit, vault, warmVaultIndexes } = await import("../lib/vault.ts");

// Pre-warm ALL indexes, pre-split sections, bootstrap packs, and gzipped vault pack BEFORE listening
const tWarm = performance.now();
warmVaultIndexes();
getBootstrapPack("user");
getBootstrapPack("dev");
const initialPack = getVaultPackGzip();
const warmMs = (performance.now() - tWarm).toFixed(1);

const PORT = Number(process.env.PORT ?? 3961);
const HOST = process.env.HOSTNAME ?? "127.0.0.1";

function clientIp(req: http.IncomingMessage): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) {
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real)?.trim() || req.socket.remoteAddress || "local";
}

function sendJson(res: http.ServerResponse, status: number, body: string, extraHeaders?: Record<string, string>) {
  res.writeHead(status, extraHeaders ? { ...JSON_HEADERS, ...extraHeaders } : JSON_HEADERS);
  res.end(body);
}

function handleSseEvents(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  if (url.searchParams.get("snapshot") === "1") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ events: recentMcpEvents(20) }));
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-store, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`: connected\n\nevent: snapshot\ndata: ${JSON.stringify(recentMcpEvents(12))}\n\n`);

  const unsub = subscribeMcpEvents((ev) => {
    try {
      res.write(`id: ${ev.id}\nevent: mcp\ndata: ${JSON.stringify(ev)}\n\n`);
    } catch {
      cleanup();
    }
  });
  const timer = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      cleanup();
    }
  }, 20_000);

  let closed = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    unsub();
    try {
      res.end();
    } catch {
      // ignore
    }
  }
  req.on("close", cleanup);
  req.on("aborted", cleanup);
}

const server = http.createServer((req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "bcbrain-mcp",
        version: SERVER_INFO.version,
        notes: vault().size,
        commit: syncCommit || undefined,
      }),
    );
    return;
  }

  if (pathname === "/mcp/events" && method === "GET") {
    handleSseEvents(req, res, url);
    return;
  }

  if (pathname === "/api/vault-pack" && method === "GET") {
    const pack = getVaultPackGzip();
    if (req.headers["if-none-match"] === pack.etag) {
      res.writeHead(304, {
        ETag: pack.etag,
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      });
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'inline; filename="bcbrain-vault-pack.json.gz"',
      "Content-Length": String(pack.gz.length),
      ETag: pack.etag,
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
      "X-BCBrain-Notes": String(pack.noteCount),
      "X-BCBrain-Commit": syncCommit || "local",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(pack.gz);
    return;
  }

  if (pathname === "/api/bootstrap-pack" && method === "GET") {
    const aud = url.searchParams.get("audience") === "dev" ? "dev" : "user";
    const fmt = url.searchParams.get("format") === "json" ? "json" : "text";
    const pack = getBootstrapPack(aud);
    const etag = fmt === "json" ? pack.etag.replace(/"$/, '-json"') : pack.etag;
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, {
        ETag: etag,
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*",
      });
      res.end();
      return;
    }
    const headers: Record<string, string> = {
      "Content-Type": fmt === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
      ETag: etag,
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    };
    res.writeHead(200, headers);
    res.end(fmt === "json" ? JSON.stringify({ audience: aud, chars: pack.chars, etag, text: pack.text }) : pack.text);
    return;
  }

  if (pathname === "/api/fast" && method === "GET") {
    const rl = checkRateLimit(clientIp(req));
    if (!rl.ok) {
      sendJson(
        res,
        429,
        '{"ok":false,"error":"Rate limit exceeded"}',
        { "Retry-After": String(rl.retryAfterSec) },
      );
      return;
    }
    const rawAud = url.searchParams.get("audience");
    const audience = rawAud === "dev" || rawAud === "all" ? rawAud : "user";
    const mode = url.searchParams.get("mode") === "normal" ? "normal" : "ultra";
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
    const etag = `"bcfast-${syncCommit || "local"}-${crypto.createHash("sha256").update(body).digest("hex").slice(0, 12)}"`;
    const cacheHeader = result.ok
      ? "public, max-age=120, s-maxage=300, stale-while-revalidate=600"
      : "no-store";
    if (result.ok && req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ETag: etag, "Cache-Control": cacheHeader, "Access-Control-Allow-Origin": "*" });
      res.end();
      return;
    }
    res.writeHead(result.ok ? 200 : 400, {
      "Content-Type": format === "text" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "Cache-Control": cacheHeader,
      ...(result.ok ? { ETag: etag } : {}),
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
    return;
  }

  if (pathname === "/mcp") {
    if (method === "GET") {
      sendJson(
        res,
        405,
        '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Method not allowed: stateless MCP server uses POST /mcp."}}',
        { Allow: "POST, DELETE, OPTIONS" },
      );
      return;
    }
    if (method === "DELETE") {
      res.writeHead(200, CORS_HEADERS);
      res.end();
      return;
    }
    if (method !== "POST") {
      sendJson(res, 405, '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Method not allowed."}}', {
        Allow: "POST, DELETE, OPTIONS",
      });
      return;
    }

    const rl = checkRateLimit(clientIp(req));
    if (!rl.ok) {
      sendJson(
        res,
        429,
        '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Rate limit exceeded (max 300 requests/minute). Please retry shortly."}}',
        { "Retry-After": String(rl.retryAfterSec) },
      );
      return;
    }

    const lenHeader = Number(req.headers["content-length"] ?? "0");
    if (Number.isFinite(lenHeader) && lenHeader > MAX_BODY_BYTES) {
      sendJson(res, 413, '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}');
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        aborted = true;
        sendJson(res, 413, '{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"Request body too large (max 32 KB)."}}');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      const rawText = Buffer.concat(chunks).toString("utf8");
      const out = handleJsonRpcPayload(rawText);
      if (out.body === null) {
        res.writeHead(out.status, CORS_HEADERS);
        res.end();
      } else {
        sendJson(res, out.status, out.body);
      }
    });
    req.on("error", () => {
      if (!res.headersSent) {
        sendJson(res, 400, '{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Failed to read request body."}}');
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  res.end('{"error":"Not found"}');
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `[bcbrain-mcp] listening on http://${HOST}:${PORT} (v${SERVER_INFO.version}, notes=${vault().size}, pack=${(initialPack.gz.length / 1024).toFixed(0)}KB gz, warm=${warmMs}ms)\n`,
  );
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
