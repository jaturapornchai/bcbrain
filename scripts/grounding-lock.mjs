// Deterministic Ground-Truth Lockfile (.sync-cache/grounding.lock.json) against D:/bcaiaccount.
// STRICTLY READ-ONLY on D:/bcaiaccount — EVERY git command passes --no-optional-locks.
// Stored under .sync-cache/ (gitignored) so hourly sync never dirties git working tree.
// Usage:
//   node scripts/grounding-lock.mjs --update [--json]
//   node scripts/grounding-lock.mjs --diff [--json]
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBcMenuTruth, loadLocalEnv, loadRouterTruth } from "./load-env.mjs";
import { extractSymbolTruth } from "./symbol-truth.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const DEFAULT_SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");
export const DEFAULT_LOCK_FILE = path.join(ROOT, ".sync-cache", "grounding.lock.json");

function sha256Of(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function gitShortHeadReadOnly(srcDir) {
  try {
    return execFileSync("git", ["--no-optional-locks", "-C", srcDir, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    }).trim();
  } catch {
    return "";
  }
}

/** Build a compact, deterministic ground-truth snapshot from D:/bcaiaccount (STRICTLY READ-ONLY). */
export function buildGroundingLock(srcDir = DEFAULT_SRC_DIR) {
  const t0 = Date.now();
  const menuTruth = loadBcMenuTruth(srcDir);
  const menuMap = {};
  for (const code of [...menuTruth.keys()].sort((a, b) => a.localeCompare(b))) {
    menuMap[code] = menuTruth.get(code).text;
  }
  const menusSha = sha256Of(menuMap);

  const routesList = [...loadRouterTruth(srcDir)].sort((a, b) => a.localeCompare(b));
  const routesSha = sha256Of(routesList);

  const symbols = extractSymbolTruth(srcDir);
  const sqlTables = {};
  for (const tbl of [...symbols.tables.keys()].sort((a, b) => a.localeCompare(b))) {
    sqlTables[tbl] = [...symbols.tables.get(tbl)].sort((a, b) => a.localeCompare(b));
  }
  const sqlSha = sha256Of(sqlTables);

  const errorList = symbols.errorList;
  const errorSha = sha256Of(errorList);

  const overallSha256 = sha256Of({ menusSha, routesSha, sqlSha, errorSha });

  return {
    version: 1,
    sourceHead: gitShortHeadReadOnly(srcDir),
    overallSha256,
    menusCount: Object.keys(menuMap).length,
    routesCount: routesList.length,
    sqlTableCount: symbols.tableCount,
    sqlColumnCount: symbols.columnCount,
    errorStringsCount: errorList.length,
    menus: {
      count: Object.keys(menuMap).length,
      sha256: menusSha,
      map: menuMap,
    },
    routes: {
      count: routesList.length,
      sha256: routesSha,
      list: routesList,
    },
    sql: {
      tableCount: symbols.tableCount,
      columnCount: symbols.columnCount,
      sha256: sqlSha,
      tables: sqlTables,
    },
    errorStrings: {
      count: errorList.length,
      sha256: errorSha,
      list: errorList,
    },
    elapsedMs: Date.now() - t0,
  };
}

export function readGroundingLock(lockFile = DEFAULT_LOCK_FILE) {
  if (!fs.existsSync(lockFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(lockFile, "utf8"));
  } catch {
    return null;
  }
}

export function saveGroundingLock(srcDir = DEFAULT_SRC_DIR, lockFile = DEFAULT_LOCK_FILE) {
  const { elapsedMs, ...lockData } = buildGroundingLock(srcDir);
  const payload = `${JSON.stringify(lockData, null, 2)}\n`;
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const tmp = `${lockFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, lockFile);
  return {
    lockFile,
    bytes: Buffer.byteLength(payload, "utf8"),
    elapsedMs,
    sourceHead: lockData.sourceHead,
    overallSha256: lockData.overallSha256,
    menusCount: lockData.menusCount,
    routesCount: lockData.routesCount,
    sqlTableCount: lockData.sqlTableCount,
    sqlColumnCount: lockData.sqlColumnCount,
    errorStringsCount: lockData.errorStringsCount,
  };
}

function diffSortedArrays(prevList, curList) {
  const prevSet = new Set(prevList ?? []);
  const curSet = new Set(curList ?? []);
  const added = [];
  const removed = [];
  for (const item of curSet) if (!prevSet.has(item)) added.push(item);
  for (const item of prevSet) if (!curSet.has(item)) removed.push(item);
  return {
    added: added.sort((a, b) => a.localeCompare(b)),
    removed: removed.sort((a, b) => a.localeCompare(b)),
  };
}

/** Compare existing lockfile against live D:/bcaiaccount ground truth. */
export function diffGroundingLock(srcDir = DEFAULT_SRC_DIR, lockFile = DEFAULT_LOCK_FILE) {
  const prev = readGroundingLock(lockFile);
  if (!prev) {
    return {
      hasLock: false,
      hasDrift: false,
      lockFile,
      note: "no grounding.lock.json yet — run `node scripts/grounding-lock.mjs --update`",
    };
  }

  const cur = buildGroundingLock(srcDir);

  // Menus diff
  const prevMenus = prev.menus?.map ?? {};
  const curMenus = cur.menus?.map ?? {};
  const menusAdded = [];
  const menusRemoved = [];
  const menusRenamed = [];
  for (const [code, text] of Object.entries(curMenus)) {
    if (!(code in prevMenus)) menusAdded.push(`${code}: ${text}`);
    else if (prevMenus[code] !== text) menusRenamed.push({ code, from: prevMenus[code], to: text });
  }
  for (const [code, text] of Object.entries(prevMenus)) {
    if (!(code in curMenus)) menusRemoved.push(`${code}: ${text}`);
  }
  menusAdded.sort((a, b) => a.localeCompare(b));
  menusRemoved.sort((a, b) => a.localeCompare(b));
  menusRenamed.sort((a, b) => a.code.localeCompare(b.code));

  // Routes diff
  const routesDiff = diffSortedArrays(prev.routes?.list, cur.routes?.list);

  // SQL tables & columns diff
  const prevTables = prev.sql?.tables ?? {};
  const curTables = cur.sql?.tables ?? {};
  const tablesDiff = diffSortedArrays(Object.keys(prevTables), Object.keys(curTables));
  const columnsAdded = [];
  const columnsRemoved = [];
  for (const tbl of Object.keys(curTables)) {
    if (!(tbl in prevTables)) continue; // new table already reported in sqlTables.added
    const cd = diffSortedArrays(prevTables[tbl], curTables[tbl]);
    for (const col of cd.added) columnsAdded.push(`${tbl}.${col}`);
    for (const col of cd.removed) columnsRemoved.push(`${tbl}.${col}`);
  }
  columnsAdded.sort((a, b) => a.localeCompare(b));
  columnsRemoved.sort((a, b) => a.localeCompare(b));

  // Validation/error strings diff
  const errorsDiff = diffSortedArrays(prev.errorStrings?.list, cur.errorStrings?.list);

  const summary = {
    menusAdded: menusAdded.length,
    menusRemoved: menusRemoved.length,
    menusRenamed: menusRenamed.length,
    routesAdded: routesDiff.added.length,
    routesRemoved: routesDiff.removed.length,
    tablesAdded: tablesDiff.added.length,
    tablesRemoved: tablesDiff.removed.length,
    columnsAdded: columnsAdded.length,
    columnsRemoved: columnsRemoved.length,
    errorsAdded: errorsDiff.added.length,
    errorsRemoved: errorsDiff.removed.length,
  };
  const hasDrift = Object.values(summary).some((n) => n > 0);

  return {
    hasLock: true,
    hasDrift,
    lockFile,
    prevHead: prev.sourceHead ?? "",
    curHead: cur.sourceHead ?? "",
    prevSha256: prev.overallSha256 ?? "",
    curSha256: cur.overallSha256,
    counts: {
      menus: cur.menusCount,
      routes: cur.routesCount,
      sqlTables: cur.sqlTableCount,
      sqlColumns: cur.sqlColumnCount,
      errorStrings: cur.errorStringsCount,
    },
    summary,
    menus: { added: menusAdded, removed: menusRemoved, renamed: menusRenamed },
    routes: routesDiff,
    sqlTables: tablesDiff,
    sqlColumns: { added: columnsAdded, removed: columnsRemoved },
    errorStrings: errorsDiff,
    elapsedMs: cur.elapsedMs,
  };
}

/** Compact token-budgeted summary for detect-changes.mjs & hourly-sync.mjs --plan-only --json --diff. */
export function summarizeGroundingDiff(diff, maxPerList = 15) {
  if (!diff || !diff.hasLock) {
    return { hasLock: false, hasDrift: false };
  }
  if (!diff.hasDrift) {
    return {
      hasLock: true,
      hasDrift: false,
      counts: diff.counts,
      sha256: diff.curSha256.slice(0, 16),
    };
  }
  const cap = (arr) => (arr.length > maxPerList ? [...arr.slice(0, maxPerList), `... (+${arr.length - maxPerList} more)`] : arr);
  return {
    hasLock: true,
    hasDrift: true,
    summary: diff.summary,
    ...(diff.menus.added.length ? { menusAdded: cap(diff.menus.added) } : {}),
    ...(diff.menus.removed.length ? { menusRemoved: cap(diff.menus.removed) } : {}),
    ...(diff.menus.renamed.length ? { menusRenamed: cap(diff.menus.renamed) } : {}),
    ...(diff.routes.added.length ? { routesAdded: cap(diff.routes.added) } : {}),
    ...(diff.routes.removed.length ? { routesRemoved: cap(diff.routes.removed) } : {}),
    ...(diff.sqlTables.added.length ? { tablesAdded: cap(diff.sqlTables.added) } : {}),
    ...(diff.sqlTables.removed.length ? { tablesRemoved: cap(diff.sqlTables.removed) } : {}),
    ...(diff.sqlColumns.added.length ? { columnsAdded: cap(diff.sqlColumns.added) } : {}),
    ...(diff.sqlColumns.removed.length ? { columnsRemoved: cap(diff.sqlColumns.removed) } : {}),
    ...(diff.errorStrings.added.length ? { errorsAdded: cap(diff.errorStrings.added) } : {}),
    ...(diff.errorStrings.removed.length ? { errorsRemoved: cap(diff.errorStrings.removed) } : {}),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const doUpdate = args.includes("--update");
  const doDiff = args.includes("--diff");
  const jsonOut = args.includes("--json");
  const fileFlagIdx = args.indexOf("--file");
  const lockFile = fileFlagIdx !== -1 && args[fileFlagIdx + 1] ? path.resolve(ROOT, args[fileFlagIdx + 1]) : DEFAULT_LOCK_FILE;

  if (doUpdate) {
    const res = saveGroundingLock(DEFAULT_SRC_DIR, lockFile);
    if (jsonOut) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(
        `grounding-lock updated (${res.elapsedMs}ms, ${(res.bytes / 1024).toFixed(1)}KB): ` +
          `menus=${res.menusCount} routes=${res.routesCount} tables=${res.sqlTableCount} cols=${res.sqlColumnCount} errors=${res.errorStringsCount} sha=${res.overallSha256.slice(0, 16)}`,
      );
    }
  } else if (doDiff || !doUpdate) {
    const diff = diffGroundingLock(DEFAULT_SRC_DIR, lockFile);
    if (jsonOut) {
      console.log(JSON.stringify(diff, null, 2));
    } else if (!diff.hasLock) {
      console.log(`grounding-lock: ${diff.note}`);
    } else if (!diff.hasDrift) {
      console.log(
        `grounding-lock diff (${diff.elapsedMs}ms): clean (0 drift) | ` +
          `menus=${diff.counts.menus} routes=${diff.counts.routes} tables=${diff.counts.sqlTables} cols=${diff.counts.sqlColumns} errors=${diff.counts.errorStrings} sha=${diff.curSha256.slice(0, 16)}`,
      );
    } else {
      const s = diff.summary;
      console.log(
        `grounding-lock diff (${diff.elapsedMs}ms): DRIFT detected | ` +
          `menus(+${s.menusAdded}/-${s.menusRemoved}/~${s.menusRenamed}) ` +
          `routes(+${s.routesAdded}/-${s.routesRemoved}) ` +
          `tables(+${s.tablesAdded}/-${s.tablesRemoved}) ` +
          `cols(+${s.columnsAdded}/-${s.columnsRemoved}) ` +
          `errors(+${s.errorsAdded}/-${s.errorsRemoved})`,
      );
    }
  }
}
