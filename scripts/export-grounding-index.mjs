// Strictly READ-ONLY runtime Ground-Truth Index exporter against D:/bcaiaccount.
// Produces compact, secret-free `public/grounding-index.json` for runtime anti-hallucination
// verification (`lib/grounding-runtime.ts` & MCP `verify_reference` & REST `/api/verify`).
// NEVER creates, edits, deletes, or locks any file inside D:/bcaiaccount.
// Usage: node scripts/export-grounding-index.mjs [--out public/grounding-index.json] [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBcMenuTruth, loadLocalEnv } from "./load-env.mjs";
import { extractSymbolTruth, FORBIDDEN_TABLES_RE } from "./symbol-truth.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const DEFAULT_SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");
export const DEFAULT_OUT_FILE = path.join(ROOT, "public", "grounding-index.json");

// Defense-in-depth forbidden security/auth tables & sensitive text checks.
const EXTRA_FORBIDDEN_TABLES_RE =
  /^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_shadow|pg_authid|pg_stats)/i;

const SECRET_GUARD_RULES = [
  ["OpenAI/Anthropic key", /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}/],
  ["AWS key", /\bA(?:KIA|SIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["URI with password", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@`'"]+:[^\s/@`'"<>{}$]+@/i],
  ["email", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|co|th|io|ai|dev|app)\b/i],
  ["Windows user path", /[A-Za-z]:\\Users\\[^\\"\s]+/i],
  ["Unix home path", /\/(?:home|Users)\/[A-Za-z0-9._-]+\//],
  ["public IPv4", /\b(?!127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|255\.)(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/],
];

function isForbiddenTable(name) {
  return FORBIDDEN_TABLES_RE.test(name) || EXTRA_FORBIDDEN_TABLES_RE.test(name);
}

function readExistingIndex(outFile) {
  if (!fs.existsSync(outFile)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
    if (parsed && typeof parsed === "object" && (parsed.menuCount > 0 || parsed.tableCount > 0)) {
      return parsed;
    }
  } catch {
    // ignore corrupt existing file
  }
  return null;
}

export function buildGroundingIndexData(srcDir = DEFAULT_SRC_DIR) {
  const sourceAvailable = fs.existsSync(srcDir);
  if (!sourceAvailable) {
    return {
      sourceAvailable: false,
      data: {
        builtAt: new Date().toISOString(),
        menuCount: 0,
        tableCount: 0,
        columnCount: 0,
        errorCount: 0,
        menus: {},
        tables: {},
      },
    };
  }

  const menuTruth = loadBcMenuTruth(srcDir);
  const menus = {};
  for (const code of [...menuTruth.keys()].sort((a, b) => a.localeCompare(b))) {
    const entry = menuTruth.get(code);
    if (!entry || !/^[1-9]\d{3}$/.test(code)) continue;
    const label = String(entry.text ?? "").trim();
    if (!label) continue;
    const topModule = String(entry.path ?? "")
      .split(" > ")[0]
      ?.trim();
    menus[code] = topModule && topModule !== label ? { code, label, module: topModule } : { code, label };
  }

  const symbols = extractSymbolTruth(srcDir);
  const tables = {};
  let columnCount = 0;
  for (const rawTbl of [...symbols.tables.keys()].sort((a, b) => a.localeCompare(b))) {
    const tbl = String(rawTbl).toLowerCase().trim();
    if (!/^[a-z][a-z0-9_]*$/.test(tbl) || isForbiddenTable(tbl)) continue;
    const cols = [...symbols.tables.get(rawTbl)]
      .map((c) => String(c).toLowerCase().trim())
      .filter((c) => /^[a-z_][a-z0-9_]*$/.test(c))
      .sort((a, b) => a.localeCompare(b));
    const uniqueCols = [...new Set(cols)];
    tables[tbl] = uniqueCols;
    columnCount += uniqueCols.length;
  }

  return {
    sourceAvailable: true,
    data: {
      builtAt: new Date().toISOString(),
      menuCount: Object.keys(menus).length,
      tableCount: Object.keys(tables).length,
      columnCount,
      errorCount: symbols.errorCount,
      menus,
      tables,
    },
  };
}

export function exportGroundingIndex({ srcDir = DEFAULT_SRC_DIR, outFile = DEFAULT_OUT_FILE } = {}) {
  const t0 = Date.now();
  const built = buildGroundingIndexData(srcDir);

  // Graceful fallback when D:/bcaiaccount is unavailable (e.g. CI or production server):
  // preserve an existing populated index rather than wiping it out.
  if (!built.sourceAvailable || (built.data.menuCount === 0 && built.data.tableCount === 0)) {
    const existing = readExistingIndex(outFile);
    if (existing) {
      return {
        preserved: true,
        sourceAvailable: built.sourceAvailable,
        outFile,
        bytes: fs.statSync(outFile).size,
        elapsedMs: Date.now() - t0,
        menuCount: existing.menuCount ?? 0,
        tableCount: existing.tableCount ?? 0,
        columnCount: existing.columnCount ?? 0,
        errorCount: existing.errorCount ?? 0,
      };
    }
  }

  const payload = JSON.stringify(built.data);
  for (const [label, re] of SECRET_GUARD_RULES) {
    if (re.test(payload)) {
      throw new Error(`Refusing to write grounding-index.json: matched security guard (${label})`);
    }
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmpFile = `${outFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, `${payload}\n`, "utf8");
  fs.renameSync(tmpFile, outFile);

  return {
    preserved: false,
    sourceAvailable: built.sourceAvailable,
    outFile,
    bytes: Buffer.byteLength(payload, "utf8") + 1,
    elapsedMs: Date.now() - t0,
    menuCount: built.data.menuCount,
    tableCount: built.data.tableCount,
    columnCount: built.data.columnCount,
    errorCount: built.data.errorCount,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outFile = outIdx !== -1 && args[outIdx + 1] ? path.resolve(ROOT, args[outIdx + 1]) : DEFAULT_OUT_FILE;
  const srcIdx = args.indexOf("--src");
  const srcDir = srcIdx !== -1 && args[srcIdx + 1] ? path.resolve(args[srcIdx + 1]) : DEFAULT_SRC_DIR;
  const jsonOut = args.includes("--json");

  const res = exportGroundingIndex({ srcDir, outFile });
  if (jsonOut) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    const mode = res.preserved ? "preserved existing" : res.sourceAvailable ? "exported" : "empty fallback";
    console.log(
      `grounding-index ${mode} (${res.elapsedMs}ms, ${(res.bytes / 1024).toFixed(1)}KB): ` +
        `menus=${res.menuCount} tables=${res.tableCount} columns=${res.columnCount} errors=${res.errorCount}`,
    );
  }
}
