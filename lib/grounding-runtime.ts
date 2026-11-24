import fs from "node:fs";
import path from "node:path";
import type { AudienceFilter } from "./groups";

export type GroundingMenuEntry = {
  code: string;
  label: string;
  module?: string;
};

export type GroundingIndexFile = {
  builtAt: string;
  menuCount: number;
  tableCount: number;
  columnCount: number;
  errorCount: number;
  menus: Record<string, GroundingMenuEntry>;
  tables: Record<string, string[]>;
};

export type VerifyAudienceInput = AudienceFilter | "both";

export type VerifyReferenceInput = {
  menus?: string[];
  tables?: string[];
  columns?: string[];
  audience?: VerifyAudienceInput;
};

export type VerifiedMenuHit = {
  code: string;
  label: string;
  module?: string;
};

export type InvalidMenuHit = {
  code: string;
  suggestions: VerifiedMenuHit[];
};

export type VerifiedTableHit = {
  table: string;
  columnCount: number;
};

export type InvalidTableHit = {
  table: string;
  suggestions: string[];
};

export type VerifiedColumnHit = {
  ref: string;
  table: string;
  column: string;
};

export type InvalidColumnHit = {
  ref: string;
  table: string;
  column: string;
  reason: string;
  suggestions: string[];
};

export type VerifyReferenceResult = {
  ok: boolean;
  indexAvailable: boolean;
  audience: AudienceFilter;
  tablesRestricted: boolean;
  restrictionNotice?: string;
  menus: {
    valid: VerifiedMenuHit[];
    invalid: InvalidMenuHit[];
    unknownMenus: string[];
  };
  tables: {
    valid: VerifiedTableHit[];
    invalid: InvalidTableHit[];
  };
  columns: {
    valid: VerifiedColumnHit[];
    invalid: InvalidColumnHit[];
  };
  summary: {
    checkedMenus: number;
    validMenus: number;
    invalidMenus: number;
    checkedTables: number;
    validTables: number;
    invalidTables: number;
    checkedColumns: number;
    validColumns: number;
    invalidColumns: number;
  };
};

export type GroundingStats = {
  available: boolean;
  builtAt: string;
  menuCount: number;
  tableCount: number;
  columnCount: number;
  errorCount: number;
};

type LoadedGroundingIndex = {
  available: boolean;
  builtAt: string;
  errorCount: number;
  menuCount: number;
  tableCount: number;
  columnCount: number;
  menuMap: Map<string, GroundingMenuEntry>;
  menuList: GroundingMenuEntry[];
  tableMap: Map<string, Set<string>>;
  tableColsSorted: Map<string, string[]>;
  tableNames: string[];
};

// Defense-in-depth: never validate or hint about internal auth/token/system tables.
const FORBIDDEN_TABLE_RE =
  /^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_shadow|pg_authid|pg_stats)/i;

let cachedIndex: LoadedGroundingIndex | null = null;
let cachedPath = "";

function resolveIndexPath(): string {
  const custom = process.env.BC_GROUNDING_INDEX_FILE?.trim();
  return custom ? path.resolve(custom) : path.join(process.cwd(), "public", "grounding-index.json");
}

function emptyLoadedIndex(): LoadedGroundingIndex {
  return {
    available: false,
    builtAt: "",
    errorCount: 0,
    menuCount: 0,
    tableCount: 0,
    columnCount: 0,
    menuMap: new Map(),
    menuList: [],
    tableMap: new Map(),
    tableColsSorted: new Map(),
    tableNames: [],
  };
}

function loadGroundingIndex(): LoadedGroundingIndex {
  const targetPath = resolveIndexPath();
  if (cachedIndex && cachedPath === targetPath) return cachedIndex;

  cachedPath = targetPath;
  if (!fs.existsSync(targetPath)) {
    cachedIndex = emptyLoadedIndex();
    return cachedIndex;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(targetPath, "utf8")) as Partial<GroundingIndexFile>;
    const menuMap = new Map<string, GroundingMenuEntry>();
    const menuList: GroundingMenuEntry[] = [];
    if (raw.menus && typeof raw.menus === "object") {
      for (const [code, entry] of Object.entries(raw.menus)) {
        const cleanCode = String(code).trim();
        if (!/^[1-9]\d{3}$/.test(cleanCode) || !entry || typeof entry !== "object") continue;
        const label = String(entry.label ?? "").trim();
        if (!label) continue;
        const mod = typeof entry.module === "string" && entry.module.trim() ? entry.module.trim() : undefined;
        const item: GroundingMenuEntry = mod ? { code: cleanCode, label, module: mod } : { code: cleanCode, label };
        menuMap.set(cleanCode, item);
        menuList.push(item);
      }
    }
    menuList.sort((a, b) => a.code.localeCompare(b.code));

    const tableMap = new Map<string, Set<string>>();
    const tableColsSorted = new Map<string, string[]>();
    const tableNames: string[] = [];
    let columnCount = 0;

    if (raw.tables && typeof raw.tables === "object") {
      for (const [rawTbl, rawCols] of Object.entries(raw.tables)) {
        const tbl = String(rawTbl).toLowerCase().trim();
        if (!/^[a-z][a-z0-9_]*$/.test(tbl) || FORBIDDEN_TABLE_RE.test(tbl) || !Array.isArray(rawCols)) continue;
        const colSet = new Set<string>();
        for (const c of rawCols) {
          const cleanCol = String(c).toLowerCase().trim();
          if (/^[a-z_][a-z0-9_]*$/.test(cleanCol)) colSet.add(cleanCol);
        }
        const sortedCols = [...colSet].sort((a, b) => a.localeCompare(b));
        tableMap.set(tbl, colSet);
        tableColsSorted.set(tbl, sortedCols);
        tableNames.push(tbl);
        columnCount += sortedCols.length;
      }
    }
    tableNames.sort((a, b) => a.localeCompare(b));

    cachedIndex = {
      available: menuList.length > 0 || tableNames.length > 0,
      builtAt: typeof raw.builtAt === "string" ? raw.builtAt : "",
      errorCount: typeof raw.errorCount === "number" && Number.isFinite(raw.errorCount) ? raw.errorCount : 0,
      menuCount: menuList.length,
      tableCount: tableNames.length,
      columnCount,
      menuMap,
      menuList,
      tableMap,
      tableColsSorted,
      tableNames,
    };
    return cachedIndex;
  } catch {
    cachedIndex = emptyLoadedIndex();
    return cachedIndex;
  }
}

export function reloadGroundingIndex(): GroundingStats {
  cachedIndex = null;
  cachedPath = "";
  return getGroundingStats();
}

export function getGroundingStats(): GroundingStats {
  const idx = loadGroundingIndex();
  return {
    available: idx.available,
    builtAt: idx.builtAt,
    menuCount: idx.menuCount,
    tableCount: idx.tableCount,
    columnCount: idx.columnCount,
    errorCount: idx.errorCount,
  };
}

function normalizeAudience(aud?: VerifyAudienceInput): AudienceFilter {
  if (aud === "user") return "user";
  if (aud === "dev") return "dev";
  return "all";
}

function editDistanceBounded(a: string, b: string, maxDist = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const al = a.length;
  const bl = b.length;
  let prev = new Int32Array(bl + 1);
  let cur = new Int32Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[bl];
}

function suggestIdentifiers(target: string, candidates: string[], maxSuggestions = 4): string[] {
  if (!target || !candidates.length) return [];
  const tTokens = new Set(target.split("_").filter((x) => x.length >= 2));
  const scored: { name: string; score: number }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let score = 0;
    if (c.startsWith(target) || target.startsWith(c)) {
      score += 55 - Math.min(20, Math.abs(c.length - target.length));
    } else if (c.includes(target) || target.includes(c)) {
      score += 36 - Math.min(16, Math.abs(c.length - target.length));
    }

    if (tTokens.size > 0) {
      const cParts = c.split("_");
      let shared = 0;
      for (const p of cParts) {
        if (tTokens.has(p)) shared++;
      }
      if (shared > 0) {
        score += (shared * 28) / Math.max(tTokens.size, cParts.length);
      }
    }

    const maxEdit = Math.min(4, Math.max(2, Math.floor(Math.max(target.length, c.length) * 0.38)));
    const dist = editDistanceBounded(target, c, maxEdit);
    if (dist <= maxEdit) {
      score += (maxEdit + 1 - dist) * 14;
    }

    if (score >= 14) {
      scored.push({ name: c, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, maxSuggestions).map((s) => s.name);
}

function suggestNearestMenus(rawCode: string, menuList: GroundingMenuEntry[], maxSuggestions = 3): VerifiedMenuHit[] {
  if (!menuList.length) return [];
  const digits = rawCode.replace(/\D/g, "");
  if (digits.length > 0) {
    const targetNum = Number(digits.slice(0, 4).padEnd(4, "0"));
    const leadDigit = digits[0];
    const scored = menuList.map((m) => {
      const mNum = Number(m.code);
      const sameCat = m.code[0] === leadDigit;
      const dist = Math.abs(mNum - targetNum);
      let prefixMatch = 0;
      while (prefixMatch < digits.length && prefixMatch < m.code.length && digits[prefixMatch] === m.code[prefixMatch]) {
        prefixMatch++;
      }
      return { m, sameCat, prefixMatch, dist };
    });
    scored.sort(
      (a, b) =>
        Number(b.sameCat) - Number(a.sameCat) ||
        b.prefixMatch - a.prefixMatch ||
        a.dist - b.dist ||
        a.m.code.localeCompare(b.m.code),
    );
    return scored.slice(0, maxSuggestions).map((s) => ({ ...s.m }));
  }

  const low = rawCode.toLowerCase();
  const labelHits = menuList.filter((m) => m.label.toLowerCase().includes(low)).slice(0, maxSuggestions);
  return labelHits.map((m) => ({ ...m }));
}

function cleanUniqueList(arr: string[] | undefined, maxItems: number): string[] {
  if (!Array.isArray(arr) || !arr.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const trimmed = String(item ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Runtime Ground-Truth Reference Verifier against `public/grounding-index.json`.
 * - Always validates 4-digit menu codes.
 * - Strictly refuses & omits SQL tables/columns when `audience === "user"` (zero schema leakage!).
 * - Validates normalized SQL tables and `table.column` references with fuzzy suggestions in `dev`/`all` mode.
 */
export function verifyReferences(input: VerifyReferenceInput): VerifyReferenceResult {
  const idx = loadGroundingIndex();
  const audience = normalizeAudience(input.audience);
  const tablesRestricted = audience === "user";

  const reqMenus = cleanUniqueList(input.menus, 50);
  const reqTables = cleanUniqueList(input.tables, 50);
  const reqColumns = cleanUniqueList(input.columns, 100);

  const validMenus: VerifiedMenuHit[] = [];
  const invalidMenus: InvalidMenuHit[] = [];
  const unknownMenus: string[] = [];

  for (const raw of reqMenus) {
    const code = raw.replace(/^เมนู\s*/i, "").trim();
    const hit = idx.menuMap.get(code);
    if (hit) {
      validMenus.push({ ...hit });
    } else {
      unknownMenus.push(code);
      invalidMenus.push({
        code,
        suggestions: suggestNearestMenus(code, idx.menuList, 3),
      });
    }
  }

  // STRICT AUDIENCE ISOLATION: in user mode, refuse and omit ALL SQL table & column verification
  // without leaking whether any table or column exists.
  if (tablesRestricted) {
    const requestedSql = reqTables.length > 0 || reqColumns.length > 0;
    return {
      ok: idx.available && invalidMenus.length === 0 && !requestedSql,
      indexAvailable: idx.available,
      audience,
      tablesRestricted: true,
      ...(requestedSql
        ? { restrictionNotice: "SQL table and column verification is disabled in user audience mode." }
        : {}),
      menus: {
        valid: validMenus,
        invalid: invalidMenus,
        unknownMenus,
      },
      tables: { valid: [], invalid: [] },
      columns: { valid: [], invalid: [] },
      summary: {
        checkedMenus: reqMenus.length,
        validMenus: validMenus.length,
        invalidMenus: invalidMenus.length,
        checkedTables: 0,
        validTables: 0,
        invalidTables: 0,
        checkedColumns: 0,
        validColumns: 0,
        invalidColumns: 0,
      },
    };
  }

  const validTables: VerifiedTableHit[] = [];
  const invalidTables: InvalidTableHit[] = [];
  const seenNormTables = new Set<string>();

  for (const raw of reqTables) {
    const tbl = raw.toLowerCase();
    if (seenNormTables.has(tbl)) continue;
    seenNormTables.add(tbl);
    if (FORBIDDEN_TABLE_RE.test(tbl)) {
      invalidTables.push({ table: tbl, suggestions: [] });
      continue;
    }
    const cols = idx.tableMap.get(tbl);
    if (cols) {
      validTables.push({ table: tbl, columnCount: cols.size });
    } else {
      invalidTables.push({
        table: tbl,
        suggestions: suggestIdentifiers(tbl, idx.tableNames, 4),
      });
    }
  }

  const validColumns: VerifiedColumnHit[] = [];
  const invalidColumns: InvalidColumnHit[] = [];
  const seenNormCols = new Set<string>();

  for (const raw of reqColumns) {
    const norm = raw.toLowerCase();
    if (seenNormCols.has(norm)) continue;
    seenNormCols.add(norm);
    const parts = norm.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      invalidColumns.push({
        ref: norm,
        table: parts[0] ?? "",
        column: parts[1] ?? "",
        reason: "expected table.column format",
        suggestions: [],
      });
      continue;
    }
    const [tbl, col] = parts;
    if (FORBIDDEN_TABLE_RE.test(tbl)) {
      invalidColumns.push({
        ref: `${tbl}.${col}`,
        table: tbl,
        column: col,
        reason: "unknown table",
        suggestions: [],
      });
      continue;
    }
    const colSet = idx.tableMap.get(tbl);
    if (!colSet) {
      const nearTables = suggestIdentifiers(tbl, idx.tableNames, 4);
      const suggestions = nearTables.map((nt) => (idx.tableMap.get(nt)?.has(col) ? `${nt}.${col}` : nt));
      invalidColumns.push({
        ref: `${tbl}.${col}`,
        table: tbl,
        column: col,
        reason: "unknown table",
        suggestions,
      });
      continue;
    }
    if (colSet.has(col)) {
      validColumns.push({ ref: `${tbl}.${col}`, table: tbl, column: col });
    } else {
      const nearCols = suggestIdentifiers(col, idx.tableColsSorted.get(tbl) ?? [], 4);
      invalidColumns.push({
        ref: `${tbl}.${col}`,
        table: tbl,
        column: col,
        reason: "unknown column",
        suggestions: nearCols.map((c) => `${tbl}.${c}`),
      });
    }
  }

  const checkedTables = validTables.length + invalidTables.length;
  const checkedColumns = validColumns.length + invalidColumns.length;
  const ok =
    idx.available && invalidMenus.length === 0 && invalidTables.length === 0 && invalidColumns.length === 0;

  return {
    ok,
    indexAvailable: idx.available,
    audience,
    tablesRestricted: false,
    menus: {
      valid: validMenus,
      invalid: invalidMenus,
      unknownMenus,
    },
    tables: {
      valid: validTables,
      invalid: invalidTables,
    },
    columns: {
      valid: validColumns,
      invalid: invalidColumns,
    },
    summary: {
      checkedMenus: reqMenus.length,
      validMenus: validMenus.length,
      invalidMenus: invalidMenus.length,
      checkedTables,
      validTables: validTables.length,
      invalidTables: invalidTables.length,
      checkedColumns,
      validColumns: validColumns.length,
      invalidColumns: invalidColumns.length,
    },
  };
}
