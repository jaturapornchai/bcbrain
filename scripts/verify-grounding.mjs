// Anti-hallucination grounding verifier against real source truth in D:/bcaiaccount (STRICTLY READ-ONLY).
// Checks:
//  1. Every frontmatter source file & line range exists within EOF.
//  2. Every 4-digit menu code explicitly referenced in menu context exists in bcMenu.json.
//  3. Every SQL table referenced in FROM/JOIN inside ```sql blocks of dev notes exists in D:/bcaiaccount.
//  4. Shrink guard on changed notes (rejects accidental >45% truncation vs git HEAD).
//  5. Live 1:1 menu catalog parity (vault/start/menu-cat-1..9-*.md vs frontend bcMenu.json).
//  6. API route grounding in vault/api/*.md against mounted Chi routes in router.go.
//  7. SQL column grounding in ```sql blocks & vault/schema/*.md against real CREATE/ALTER TABLE columns.
// Usage: node scripts/verify-grounding.mjs [--files vault/a.md,vault/b.md]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { auditMenuCatalogParity, loadBcMenuTruth, loadLocalEnv, loadRouterTruth, matchRouterPath } from "./load-env.mjs";
import { extractSymbolTruth } from "./symbol-truth.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, "vault");
const SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");
const WEB_SRC = path.resolve(process.env.BC_WEBSITE_SRC ?? "D:/bcaiwebsite-live");

const DEV_FOLDERS = new Set(["dev-playbook", "schema", "queries", "api", "doctypes", "architecture"]);
const EXCLUDED_YEARS = (n) => (n >= 2015 && n <= 2035) || (n >= 2555 && n <= 2585);
const KNOWN_SQL_PREFIXES = /^(?:ic|ar|ap|cb|gl|fa|erp|pos|wms|tms|ac|crm|bc|hr|pr|po|so|wh|doc|tax|inv|line|mkt|bi|wm|ai)_[a-z0-9_]+$/;
const BUILTIN_SQL_TABLES = new Set([
  "information_schema",
  "pg_catalog",
  "pg_tables",
  "pg_class",
  "pg_namespace",
  "generate_series",
  "unnest",
]);
const SQL_ALIAS_STOPWORDS = new Set([
  "where",
  "on",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "cross",
  "join",
  "group",
  "order",
  "limit",
  "offset",
  "having",
  "union",
  "except",
  "intersect",
  "set",
  "values",
  "returning",
  "using",
  "and",
  "or",
  "as",
  "into",
  "select",
  "from",
  "lateral",
  "natural",
  "when",
  "then",
  "else",
  "end",
  "case",
  "for",
  "update",
]);
const PG_SYSTEM_COLUMNS = new Set(["roworder", "ctid", "xmin", "xmax", "cmin", "cmax", "tableoid", "oid"]);
const SQL_TYPE_KEYWORDS = new Set([
  "varchar",
  "numeric",
  "smallint",
  "integer",
  "bigint",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "text",
  "bytea",
  "serial",
  "bigserial",
  "json",
  "jsonb",
  "uuid",
]);

function walkFiles(dir, extFilter) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === ".next") continue;
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && extFilter(e.name)) out.push(p);
    }
  }
  return out;
}

function loadGroundTruth() {
  const validMenus = new Set(loadBcMenuTruth(SRC_DIR).keys());

  const validTables = new Set();
  const sqlFiles = [
    ...walkFiles(path.join(SRC_DIR, "scripts/sql"), (n) => n.endsWith(".sql")),
    ...walkFiles(path.join(SRC_DIR, "backend/migrations"), (n) => n.endsWith(".sql")),
    ...walkFiles(path.join(SRC_DIR, "backend/internal"), (n) => n.endsWith(".go") && !n.endsWith("_test.go")),
  ];
  for (const f of sqlFiles) {
    const txt = fs.readFileSync(f, "utf8");
    for (const m of txt.matchAll(/\b([a-z]{2,4}_[a-z0-9_]{2,})\b/g)) {
      const id = m[1].toLowerCase();
      if (KNOWN_SQL_PREFIXES.test(id)) validTables.add(id);
    }
  }
  return { validMenus, validTables };
}

function extractSqlBlocks(body) {
  const blocks = [];
  for (const m of body.matchAll(/```sql\s*\n([\s\S]*?)```/gi)) blocks.push(m[1]);
  return blocks;
}

function extractCteNames(sql) {
  const ctes = new Set();
  for (const m of sql.matchAll(/(?:\bWITH(?:\s+RECURSIVE)?|,)\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi)) {
    ctes.add(m[1].toLowerCase());
  }
  return ctes;
}

function gitPrevContent(relFromRoot) {
  try {
    return execFileSync("git", ["show", `HEAD:${relFromRoot.replace(/\\/g, "/")}`], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

const filesArgIdx = process.argv.indexOf("--files");
const targetFiles =
  filesArgIdx !== -1 && process.argv[filesArgIdx + 1]
    ? process.argv[filesArgIdx + 1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => path.resolve(ROOT, s))
    : walkFiles(VAULT_DIR, (n) => n.endsWith(".md"));

const isScoped = filesArgIdx !== -1;
const { validMenus, validTables } = loadGroundTruth();
const validRoutes = loadRouterTruth(SRC_DIR);
const symbolTruth = extractSymbolTruth(SRC_DIR);
const lineCache = new Map();
const getLines = (p) => {
  if (!lineCache.has(p)) lineCache.set(p, fs.readFileSync(p, "utf8").split("\n").length);
  return lineCache.get(p);
};

const errors = [];
const warnings = [];
let checkedMenus = 0;
let checkedTables = 0;
let checkedColumns = 0;
let checkedRoutes = 0;

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  const relFromRoot = path.relative(ROOT, file).replace(/\\/g, "/");
  const relVault = path.relative(VAULT_DIR, file).replace(/\\/g, "/");
  const folder = relVault.includes("/") ? relVault.split("/")[0] : "root";
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) {
    errors.push(`${relFromRoot}: missing YAML frontmatter`);
    continue;
  }
  const meta = parseYaml(fm[1]) ?? {};
  const body = text.slice(fm[0].length);

  // 1. Source existence & EOF check
  for (const raw of Array.isArray(meta.sources) ? meta.sources : []) {
    const m = String(raw).match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
    if (!m || !m[1]) continue;
    const isWeb = m[1].startsWith("bcaiwebsite-live/");
    const abs = isWeb ? path.join(WEB_SRC, m[1].slice("bcaiwebsite-live/".length)) : path.join(SRC_DIR, m[1]);
    if (!fs.existsSync(abs)) {
      errors.push(`${relFromRoot}: source does not exist -> ${raw}`);
      continue;
    }
    if (fs.statSync(abs).isDirectory()) continue;
    const tot = getLines(abs);
    const s = m[2] ? Number(m[2]) : null;
    const e = m[3] ? Number(m[3]) : null;
    if ((s !== null && (s < 1 || s > tot)) || (e !== null && (e > tot || (s !== null && e < s)))) {
      errors.push(`${relFromRoot}: source range past EOF (${tot} lines) -> ${raw}`);
    }
  }

  // 2. Menu code grounding check (strict on scoped updated files; advisory on legacy full scan)
  const MENU_CTX = /(?:รหัสเมนู|เมนู|menu)\s*\*{0,2}`?([1-9]\d{3})`?\*{0,2}/gi;
  for (const m of body.matchAll(MENU_CTX)) {
    const code = m[1];
    if (EXCLUDED_YEARS(Number(code))) continue;
    checkedMenus++;
    if (validMenus.size > 100 && !validMenus.has(code)) {
      const msg = `${relFromRoot}: unverified menu code "${code}" not found in bcMenu.json`;
      if (isScoped) errors.push(msg);
      else warnings.push(msg);
    }
  }

  // 3. Dev SQL table grounding check
  if (DEV_FOLDERS.has(folder) && validTables.size > 50) {
    for (const sql of extractSqlBlocks(body)) {
      const ctes = extractCteNames(sql);
      for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?"?([a-z]{2,4}_[a-z0-9_]{2,})"?/gi)) {
        const tbl = m[1].toLowerCase();
        if (ctes.has(tbl) || BUILTIN_SQL_TABLES.has(tbl) || !KNOWN_SQL_PREFIXES.test(tbl)) continue;
        checkedTables++;
        if (!validTables.has(tbl)) {
          const msg = `${relFromRoot}: SQL table "${tbl}" not found in D:/bcaiaccount schema/backend`;
          if (isScoped) errors.push(msg);
          else warnings.push(msg);
        }
      }
    }
  }

  // 4. API route grounding in api/ notes against mounted Chi routes in router.go
  if (folder === "api" && validRoutes.size > 10) {
    const ROUTE_CTX = /`(\/(?:api\/v1|process|auth|query|blob|admin|language|public|ai|company-brain|mcp|help|health)[^\s`?()]*)`/g;
    for (const m of body.matchAll(ROUTE_CTX)) {
      const route = m[1];
      checkedRoutes++;
      if (!matchRouterPath(route, validRoutes)) {
        const msg = `${relFromRoot}: API route "${route}" not mounted in router.go`;
        if (isScoped) errors.push(msg);
        else warnings.push(msg);
      }
    }
  }

  // 7. SQL column grounding in ```sql blocks & vault/schema/*.md against real CREATE/ALTER TABLE columns
  if (DEV_FOLDERS.has(folder) && symbolTruth.tableCount > 50) {
    for (const rawSql of extractSqlBlocks(body)) {
      const sql = rawSql
        .replace(/--[^\r\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/'(?:''|[^'])*'/g, "''");
      const ctes = extractCteNames(sql);
      const cteOrSubqueryAliases = new Set(ctes);
      for (const sm of sql.matchAll(/\)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)\b/gi)) {
        const alias = sm[1].toLowerCase();
        if (!SQL_ALIAS_STOPWORDS.has(alias)) cteOrSubqueryAliases.add(alias);
      }

      const aliasMap = new Map();
      const bindAlias = (alias, tbl) => {
        let bucket = aliasMap.get(alias);
        if (!bucket) {
          bucket = new Set();
          aliasMap.set(alias, bucket);
        }
        bucket.add(tbl);
      };

      for (const tm of sql.matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?(?:\s+(?:AS\s+)?([a-z_][a-z0-9_]*))?/gi)) {
        const tbl = tm[1].toLowerCase();
        const alias = tm[2]?.toLowerCase();
        if (ctes.has(tbl)) {
          if (alias && !SQL_ALIAS_STOPWORDS.has(alias)) cteOrSubqueryAliases.add(alias);
          continue;
        }
        if (!symbolTruth.tables.has(tbl)) continue;
        bindAlias(tbl, tbl);
        if (alias && !SQL_ALIAS_STOPWORDS.has(alias)) bindAlias(alias, tbl);
      }

      const seenMissingInBlock = new Set();
      for (const qm of sql.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
        const alias = qm[1].toLowerCase();
        const col = qm[2].toLowerCase();
        if (cteOrSubqueryAliases.has(alias) || PG_SYSTEM_COLUMNS.has(col)) continue;
        const boundTables = aliasMap.get(alias);
        if (!boundTables) continue;
        checkedColumns++;
        let found = false;
        for (const tbl of boundTables) {
          if (symbolTruth.tables.get(tbl)?.has(col)) {
            found = true;
            break;
          }
        }
        if (!found) {
          const key = `${alias}.${col}`;
          if (seenMissingInBlock.has(key)) continue;
          seenMissingInBlock.add(key);
          const msg = `${relFromRoot}: SQL column "${alias}.${col}" not found on table [${[...boundTables].join("|")}] in D:/bcaiaccount DDL`;
          if (isScoped) errors.push(msg);
          else warnings.push(msg);
        }
      }
    }

    if (folder === "schema") {
      let currentTables = [];
      let inColTable = false;
      for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (/^#{2,3}\s+/.test(trimmed)) {
          const matchedTables = [];
          for (const hm of trimmed.matchAll(/`([a-z][a-z0-9_]*)`/g)) {
            const candidate = hm[1].toLowerCase();
            if (symbolTruth.tables.has(candidate)) matchedTables.push(candidate);
          }
          if (matchedTables.length > 0) currentTables = matchedTables;
          else if (/^##\s+/.test(trimmed)) currentTables = [];
          inColTable = false;
          continue;
        }
        if (!trimmed.startsWith("|")) {
          inColTable = false;
          continue;
        }
        if (currentTables.length === 0) continue;
        const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
        if (cells.length < 2 || cells.every((c) => /^:?-+:?$/.test(c))) continue;
        if (!inColTable) {
          if (/คอลัมน์|column|ฟิลด์|field/i.test(cells[0])) inColTable = true;
          continue;
        }
        for (const cm of cells[0].matchAll(/`([a-z][a-z0-9_]*)`/g)) {
          const col = cm[1].toLowerCase();
          if (PG_SYSTEM_COLUMNS.has(col) || SQL_TYPE_KEYWORDS.has(col) || symbolTruth.tables.has(col)) continue;
          checkedColumns++;
          const found = currentTables.some((tbl) => symbolTruth.tables.get(tbl)?.has(col));
          if (!found) {
            const msg = `${relFromRoot}: schema column "${col}" not found on table [${currentTables.join("|")}] in D:/bcaiaccount DDL`;
            if (isScoped) errors.push(msg);
            else warnings.push(msg);
          }
        }
      }
    }
  }

  // 5. Shrink guard on scoped updated files
  if (isScoped) {
    const prev = gitPrevContent(relFromRoot);
    if (prev && prev.length > 600 && text.length < prev.length * 0.55) {
      errors.push(`${relFromRoot}: shrink guard triggered (${prev.length} -> ${text.length} chars, >45% dropped)`);
    }
  }
}

console.log(
  `verify-grounding: checked ${targetFiles.length} notes (menus=${checkedMenus}, sqlTables=${checkedTables}, sqlColumns=${checkedColumns}, apiRoutes=${checkedRoutes}, groundTruth=${validMenus.size} menus / ${symbolTruth.tableCount} tables / ${symbolTruth.columnCount} columns / ${validRoutes.size} routes / ${symbolTruth.errorCount} errorStrings)`,
);
const scopedSet = isScoped ? new Set(targetFiles.map((f) => path.relative(ROOT, f).replace(/\\/g, "/"))) : null;
const parity = auditMenuCatalogParity(ROOT, SRC_DIR, scopedSet);
for (const mm of parity.mismatchedFiles) {
  errors.push(`${mm.note}: ${mm.issues.length} menu parity error(s) — first: ${mm.issues[0]}`);
}
if (parity.checkedRows) {
  console.log(`verify-grounding: menu-cat 1:1 parity checked ${parity.checkedRows} screen rows (mismatchFiles=${parity.mismatchedFiles.length})`);
}
console.log(`errors=${errors.length}, warnings=${warnings.length}`);
for (const e of errors.slice(0, 50)) console.log("ERR ", e);
if (process.env.VERBOSE) {
  for (const w of warnings.slice(0, 30)) console.log("WARN", w);
}
process.exit(errors.length ? 1 : 0);
