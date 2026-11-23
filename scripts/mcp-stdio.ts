// Zero-latency Local Stdio MCP Server for BC Brain (<1 ms per call, 0 network RTT, auto-syncs ~670KB gzip pack via ETag).
// Usage:
//   node scripts/mcp-stdio.ts                       (uses local ./vault if present, else auto-syncs from brain.bcsmethai.com)
//   node scripts/mcp-stdio.ts --sync                (force sync from https://brain.bcsmethai.com/api/vault-pack into local cache)
//   BC_PACK_URL=https://brain.bcsmethai.com/api/vault-pack node scripts/mcp-stdio.ts
import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

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

const PACK_URL = process.env.BC_PACK_URL ?? "https://brain.bcsmethai.com/api/vault-pack";
const CACHE_DIR = path.join(os.homedir(), ".cache", "bcbrain");
const PACK_FILE = path.join(CACHE_DIR, "vault-pack.json.gz");
const ETAG_FILE = path.join(CACHE_DIR, "vault-pack.etag");
const FORCE_SYNC = process.argv.includes("--sync");
const LOCAL_VAULT_DIR = path.join(process.cwd(), "vault");
const USE_REMOTE_PACK = FORCE_SYNC || !fs.existsSync(LOCAL_VAULT_DIR);

async function syncVaultPackOnce(): Promise<boolean> {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const prevEtag = fs.existsSync(ETAG_FILE) ? fs.readFileSync(ETAG_FILE, "utf8").trim() : "";
    const headers: Record<string, string> = {};
    if (prevEtag && fs.existsSync(PACK_FILE)) headers["If-None-Match"] = prevEtag;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(PACK_URL, { headers, signal: ctrl.signal }).finally(() => clearTimeout(timer));
    if (res.status === 304) return false;
    if (!res.ok) {
      process.stderr.write(`[bcbrain-stdio] pack sync HTTP ${res.status}\n`);
      return false;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = `${PACK_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, PACK_FILE);
    const etag = res.headers.get("etag");
    if (etag) fs.writeFileSync(ETAG_FILE, etag, "utf8");
    process.stderr.write(`[bcbrain-stdio] synced vault pack (${(buf.length / 1024).toFixed(0)} KB gz)\n`);
    return true;
  } catch (err) {
    process.stderr.write(`[bcbrain-stdio] pack sync skipped: ${err instanceof Error ? err.message : String(err)}\n`);
    return false;
  }
}

if (USE_REMOTE_PACK) {
  await syncVaultPackOnce();
  if (fs.existsSync(PACK_FILE)) {
    process.env.BC_VAULT_PACK_FILE = PACK_FILE;
  }
}

const { dispatchJsonRpcRaw, setMcpLogging } = await import("../lib/mcp-engine.ts");
const { reloadVaultBundle, vault, warmVaultIndexes } = await import("../lib/vault.ts");

// CRITICAL for Stdio MCP: stdout must contain ONLY JSON-RPC 2.0 lines
setMcpLogging(false);
warmVaultIndexes();
process.stderr.write(
  `[bcbrain-stdio] ready (${vault().size} notes, source=${process.env.BC_VAULT_PACK_FILE ? "cached-pack" : "local-vault"})\n`,
);

// Background ETag refresh every 30 minutes when running in remote-pack mirror mode
if (USE_REMOTE_PACK) {
  const interval = setInterval(async () => {
    const changed = await syncVaultPackOnce();
    if (changed && fs.existsSync(PACK_FILE)) {
      process.env.BC_VAULT_PACK_FILE = PACK_FILE;
      reloadVaultBundle();
      process.stderr.write(`[bcbrain-stdio] hot-reloaded (${vault().size} notes)\n`);
    }
  }, 30 * 60 * 1000);
  interval.unref();
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    process.stdout.write('{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}\n');
    return;
  }
  if (Array.isArray(parsed)) {
    const out = parsed
      .map((item) => dispatchJsonRpcRaw(item as Parameters<typeof dispatchJsonRpcRaw>[0]))
      .filter((r): r is string => r !== null);
    if (out.length) process.stdout.write(`[${out.join(",")}]\n`);
    return;
  }
  const resp = dispatchJsonRpcRaw(parsed as Parameters<typeof dispatchJsonRpcRaw>[0]);
  if (resp !== null) process.stdout.write(`${resp}\n`);
});
