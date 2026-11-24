// Strictly READ-ONLY symbol & column-level ground truth extractor against D:/bcaiaccount.
// Extracts:
//  (a) SQL table -> Set<column_name> from CREATE TABLE / ALTER TABLE ADD COLUMN
//      in scripts/sql/*.sql, backend/migrations/*.sql, and Go runtime migrations in backend/internal/**/*.go.
//  (b) Real Thai validation/error strings from validation("..."), fmt.Errorf("..."), and errors.New("...")
//      in backend/internal/application/process/*.go.
// NEVER creates, edits, deletes, or locks any file inside D:/bcaiaccount.
// Usage: node scripts/symbol-truth.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const DEFAULT_SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");

// Security boundary: never surface auth/token/system tables in ground-truth reports or lockfiles.
export const FORBIDDEN_TABLES_RE =
  /^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_shadow|pg_authid|pg_stats)/i;

const SQL_CONSTRAINT_KEYWORDS = new Set([
  "primary",
  "foreign",
  "unique",
  "check",
  "constraint",
  "exclude",
  "like",
  "inherited",
]);

const SENSITIVE_TEXT_RE =
  /(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:\d{1,3}\.){3}\d{1,3})/;

function walkFilesSorted(dir, predicate) {
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
      const abs = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile() && predicate(e.name)) out.push(abs);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function parseDdlInto(rawInput, tables) {
  const raw = rawInput.replace(/--[^\r\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const ensureTable = (name) => {
    const tbl = name.toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(tbl) || tbl.length < 3) return null;
    if (FORBIDDEN_TABLES_RE.test(tbl)) return null;
    let set = tables.get(tbl);
    if (!set) {
      set = new Set();
      tables.set(tbl, set);
    }
    return set;
  };

  // 1. CREATE TABLE [IF NOT EXISTS] [public.]"tbl" ( col1 type, col2 type, ... )
  const createRe =
    /\bCREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\(/gi;
  let m;
  while ((m = createRe.exec(raw)) !== null) {
    const tblCols = ensureTable(m[1]);
    let i = createRe.lastIndex;
    let depth = 1;
    let inSingleQuote = false;
    while (i < raw.length && depth > 0) {
      const ch = raw[i];
      if (ch === "'" && raw[i - 1] !== "\\") inSingleQuote = !inSingleQuote;
      else if (!inSingleQuote) {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
      }
      i += 1;
    }
    if (depth !== 0 || !tblCols) continue;

    const body = raw.slice(createRe.lastIndex, i - 1);
    const parts = [];
    let cur = "";
    let d = 0;
    let sq = false;
    for (let j = 0; j < body.length; j++) {
      const ch = body[j];
      if (ch === "'" && body[j - 1] !== "\\") sq = !sq;
      else if (!sq) {
        if (ch === "(") d += 1;
        else if (ch === ")") d -= 1;
        else if (ch === "," && d === 0) {
          parts.push(cur);
          cur = "";
          continue;
        }
      }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const cm = trimmed.match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+([a-zA-Z_"])/);
      if (!cm) continue;
      const col = cm[1].toLowerCase();
      if (SQL_CONSTRAINT_KEYWORDS.has(col)) continue;
      tblCols.add(col);
    }
  }

  // 2. ALTER TABLE [IF EXISTS] [ONLY] [public.]"tbl" ADD [COLUMN] [IF NOT EXISTS] "col" <type>
  const alterRe =
    /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+([\s\S]*?)(?:;|$)/gi;
  while ((m = alterRe.exec(raw)) !== null) {
    const tblCols = ensureTable(m[1]);
    if (!tblCols) continue;
    const clause = m[2];
    for (const am of clause.matchAll(
      /\bADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+(?!CONSTRAINT\b|PRIMARY\b|FOREIGN\b|UNIQUE\b|CHECK\b|EXCLUDE\b)([a-zA-Z_"])/gi,
    )) {
      const col = am[1].toLowerCase();
      if (!SQL_CONSTRAINT_KEYWORDS.has(col)) tblCols.add(col);
    }
  }
}

/**
 * Strictly READ-ONLY SQL schema column extractor.
 * Primary source: scripts/sql/*.sql & backend/migrations/*.sql.
 * Secondary supplement: Go runtime DDL literals (CREATE TABLE / ALTER TABLE ADD COLUMN) in backend/internal/**\/*.go.
 */
export function extractSqlColumns(srcDir = DEFAULT_SRC_DIR) {
  const sqlFiles = [
    ...walkFilesSorted(path.join(srcDir, "scripts/sql"), (n) => n.endsWith(".sql")),
    ...walkFilesSorted(path.join(srcDir, "backend/migrations"), (n) => n.endsWith(".sql")),
  ];

  const tables = new Map();
  for (const file of sqlFiles) {
    parseDdlInto(fs.readFileSync(file, "utf8"), tables);
  }

  const sqlTableCount = tables.size;
  let sqlColumnCount = 0;
  for (const cols of tables.values()) sqlColumnCount += cols.size;

  // Supplement with Go runtime DDL migrations (e.g. db_migrate.go) so modern BC Ai Account tables are covered too.
  const goFiles = walkFilesSorted(
    path.join(srcDir, "backend/internal"),
    (n) => n.endsWith(".go") && !n.endsWith("_test.go"),
  );
  let goDdlFileCount = 0;
  for (const file of goFiles) {
    const txt = fs.readFileSync(file, "utf8");
    if (!/(?:CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE|ALTER\s+TABLE)/i.test(txt)) continue;
    let touched = false;
    for (const gm of txt.matchAll(/`([\s\S]*?)`/g)) {
      if (/(?:CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE|ALTER\s+TABLE)/i.test(gm[1])) {
        parseDdlInto(gm[1], tables);
        touched = true;
      }
    }
    for (const gm of txt.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
      if (/(?:CREATE\s+(?:TEMP\s+|TEMPORARY\s+|UNLOGGED\s+)?TABLE|ALTER\s+TABLE)/i.test(gm[1])) {
        parseDdlInto(gm[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t"), tables);
        touched = true;
      }
    }
    if (touched) goDdlFileCount += 1;
  }

  let columnCount = 0;
  for (const cols of tables.values()) columnCount += cols.size;

  return {
    tables,
    tableCount: tables.size,
    columnCount,
    sqlTableCount,
    sqlColumnCount,
    sqlFileCount: sqlFiles.length,
    goDdlFileCount,
  };
}

function unescapeGoString(raw, isRawBacktick) {
  const text = isRawBacktick
    ? raw
    : raw
        .replace(/\\n/g, " ")
        .replace(/\\t/g, " ")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Strictly READ-ONLY Thai validation/error string extractor from
 * validation("..."), fmt.Errorf("..."), and errors.New("...") in backend/internal/application/process/*.go.
 */
export function extractGoErrorStrings(srcDir = DEFAULT_SRC_DIR) {
  const procDir = path.join(srcDir, "backend/internal/application/process");
  const goFiles = walkFilesSorted(procDir, (n) => n.endsWith(".go") && !n.endsWith("_test.go"));

  const seen = new Map(); // message -> { message, kind, files: Set<string> }
  const patterns = [
    { kind: "validation", re: /\bvalidation\s*\(\s*"((?:\\.|[^"\\])+)"/g, raw: false },
    { kind: "validation", re: /\bvalidation\s*\(\s*`([^`]+)`/g, raw: true },
    { kind: "fmt.Errorf", re: /\bfmt\.Errorf\s*\(\s*"((?:\\.|[^"\\])+)"/g, raw: false },
    { kind: "fmt.Errorf", re: /\bfmt\.Errorf\s*\(\s*`([^`]+)`/g, raw: true },
    { kind: "errors.New", re: /\berrors\.New\s*\(\s*"((?:\\.|[^"\\])+)"/g, raw: false },
    { kind: "errors.New", re: /\berrors\.New\s*\(\s*`([^`]+)`/g, raw: true },
  ];

  for (const file of goFiles) {
    const rel = path.relative(srcDir, file).replace(/\\/g, "/");
    const txt = fs.readFileSync(file, "utf8");
    for (const pat of patterns) {
      for (const m of txt.matchAll(pat.re)) {
        const msg = unescapeGoString(m[1], pat.raw);
        if (msg.length < 4 || !/[\u0E00-\u0E7F]/.test(msg)) continue;
        if (SENSITIVE_TEXT_RE.test(msg)) continue;
        let entry = seen.get(msg);
        if (!entry) {
          entry = { message: msg, kind: pat.kind, files: new Set() };
          seen.set(msg, entry);
        }
        entry.files.add(rel);
      }
    }
  }

  const list = [...seen.keys()].sort((a, b) => a.localeCompare(b));
  const entries = list.map((msg) => {
    const e = seen.get(msg);
    return { message: e.message, kind: e.kind, files: [...e.files].sort() };
  });

  return {
    errorStrings: new Set(list),
    list,
    entries,
    count: list.length,
    fileCount: goFiles.length,
  };
}

/** Combined READ-ONLY ground truth extractor for SQL tables/columns + Go Thai validation/error strings. */
export function extractSymbolTruth(srcDir = DEFAULT_SRC_DIR) {
  const t0 = Date.now();
  const sql = extractSqlColumns(srcDir);
  const errs = extractGoErrorStrings(srcDir);
  return {
    tables: sql.tables,
    tableCount: sql.tableCount,
    columnCount: sql.columnCount,
    sqlTableCount: sql.sqlTableCount,
    sqlColumnCount: sql.sqlColumnCount,
    sqlFileCount: sql.sqlFileCount,
    goDdlFileCount: sql.goDdlFileCount,
    errorStrings: errs.errorStrings,
    errorList: errs.list,
    errorEntries: errs.entries,
    errorCount: errs.count,
    goProcessFileCount: errs.fileCount,
    elapsedMs: Date.now() - t0,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const truth = extractSymbolTruth(DEFAULT_SRC_DIR);
  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          tableCount: truth.tableCount,
          columnCount: truth.columnCount,
          sqlTableCount: truth.sqlTableCount,
          sqlColumnCount: truth.sqlColumnCount,
          sqlFileCount: truth.sqlFileCount,
          goDdlFileCount: truth.goDdlFileCount,
          errorCount: truth.errorCount,
          goProcessFileCount: truth.goProcessFileCount,
          elapsedMs: truth.elapsedMs,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `symbol-truth (${truth.elapsedMs}ms): ${truth.tableCount} tables (${truth.columnCount} columns; sql=${truth.sqlTableCount}/${truth.sqlColumnCount}, goDdlFiles=${truth.goDdlFileCount}), ${truth.errorCount} Thai validation/error strings (${truth.goProcessFileCount} process/*.go files)`,
    );
  }
}
