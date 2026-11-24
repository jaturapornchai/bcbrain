// Strictly READ-ONLY change detector & vault impact mapper against D:/bcaiaccount.
// NEVER writes, creates, locks, or modifies anything inside BC_SOURCE_DIR.
// Usage: node scripts/detect-changes.mjs [--json]
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { diffGroundingLock, summarizeGroundingDiff } from "./grounding-lock.mjs";
import { auditMenuCatalogParity, loadBcMenuTruth, loadLocalEnv } from "./load-env.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, "vault");
const STATE_FILE = path.join(ROOT, ".sync-state.json");
const SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");

const WATCH_ROOTS = [
  "backend/internal",
  "backend/cmd",
  "backend/migrations",
  "scripts/sql",
  "frontend/account",
  "frontend/shared",
  "frontend/src/config",
  "frontend/src/lib",
  "frontend/pos/lib",
  "services/company-brain/src",
];
const WATCH_SINGLE_FILES = ["AGENTS.md"];
const ALLOWED_EXTS = new Set([".go", ".sql", ".ts", ".tsx", ".json", ".dart", ".md"]);
const IGNORED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", "tmp", "logs", "coverage", "__pycache__"]);

export function isRelevantSourceRel(rel) {
  const norm = rel.replace(/\\/g, "/");
  if (WATCH_SINGLE_FILES.includes(norm)) return true;
  if (!WATCH_ROOTS.some((r) => norm === r || norm.startsWith(r + "/"))) return false;
  const base = path.posix.basename(norm);
  if (base === "buildInfo.ts" || base === "package-lock.json") return false;
  if (/_test\.go$|\.(?:test|spec)\.[tj]sx?$|\.d\.ts$/i.test(base)) return false;
  const ext = path.posix.extname(base).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

function walkSources(absDir, relPrefix, out) {
  if (!fs.existsSync(absDir)) return;
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || IGNORED_DIRS.has(e.name)) continue;
    const abs = path.join(absDir, e.name);
    const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      walkSources(abs, rel, out);
    } else if (e.isFile() && isRelevantSourceRel(rel)) {
      const buf = fs.readFileSync(abs);
      const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
      let lines = 1;
      for (let i = 0; i < buf.length; i++) if (buf[i] === 10) lines++;
      out[rel] = { sha, lines, bytes: buf.length };
    }
  }
}

function gitReadOnly(repoDir, args) {
  try {
    return execFileSync("git", ["--no-optional-locks", "-C", repoDir, ...args], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
    }).trim();
  } catch {
    return "";
  }
}

function walkVault(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkVault(p) : e.isFile() && e.name.endsWith(".md") ? [p] : [];
  });
}

function indexVaultSources(sourceFiles) {
  const sourceToNotes = new Map();
  const brokenNotes = [];
  const coveredMenus = new Set();
  const coveredTables = new Set();
  const allNotes = walkVault(VAULT_DIR);

  for (const file of allNotes) {
    const rel = path.relative(VAULT_DIR, file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    for (const m of text.matchAll(/\b([1-9]\d{3})\b/g)) coveredMenus.add(m[1]);
    for (const m of text.matchAll(/\b([a-z]{2,4}_[a-z0-9_]+)\b/g)) coveredTables.add(m[1]);

    const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!fm) continue;
    let meta = {};
    try {
      meta = parseYaml(fm[1]) ?? {};
    } catch {
      brokenNotes.push({ note: `vault/${rel}`, issues: ["invalid YAML frontmatter"] });
      continue;
    }
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    const issues = [];
    for (const raw of sources) {
      const m = String(raw).match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
      if (!m || !m[1]) continue;
      const srcPath = m[1].replace(/\\/g, "/");
      if (srcPath.startsWith("bcaiwebsite-live/")) continue;

      let bucket = sourceToNotes.get(srcPath);
      if (!bucket) {
        bucket = new Set();
        sourceToNotes.set(srcPath, bucket);
      }
      bucket.add(`vault/${rel}`);

      const abs = path.join(SRC_DIR, srcPath);
      if (!fs.existsSync(abs)) {
        issues.push(`source missing: ${raw}`);
        continue;
      }
      const st = fs.statSync(abs);
      if (st.isDirectory()) continue;
      const totalLines = sourceFiles[srcPath]?.lines ?? fs.readFileSync(abs, "utf8").split("\n").length;
      const start = m[2] ? Number(m[2]) : null;
      const end = m[3] ? Number(m[3]) : null;
      if (start !== null && (start < 1 || start > totalLines)) {
        issues.push(`source start out of bounds (${totalLines} lines): ${raw}`);
      } else if (end !== null && (end > totalLines || (start !== null && end < start))) {
        issues.push(`source end past EOF (${totalLines} lines): ${raw}`);
      }
    }
    if (issues.length) brokenNotes.push({ note: `vault/${rel}`, issues });
  }

  return { sourceToNotes, brokenNotes, coveredMenus, coveredTables, vaultCount: allNotes.length };
}

function detectUncoveredEntities(coveredMenus, coveredTables) {
  const menuTruth = loadBcMenuTruth(SRC_DIR);
  const uncoveredMenus = [];
  for (const [code, info] of menuTruth) {
    if (!coveredMenus.has(code)) uncoveredMenus.push(`${code} (${info.text})`);
  }

  const uncoveredTables = [];
  const sqlPath = path.join(SRC_DIR, "scripts/sql/02_data_schema.sql");
  const forbidden = /^(?:bc_user_list|bc_mcp_access_tokens|bc_mcp_token_databases|bc_mcp_token_audit|bc_google_account|pg_)/i;
  if (fs.existsSync(sqlPath)) {
    const txt = fs.readFileSync(sqlPath, "utf8");
    const seen = new Set();
    for (const m of txt.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z][a-z0-9_]+)"?/gi)) {
      const tbl = m[1].toLowerCase();
      if (!seen.has(tbl) && !forbidden.test(tbl) && !coveredTables.has(tbl)) {
        seen.add(tbl);
        uncoveredTables.push(tbl);
      }
    }
  }
  return { uncoveredMenus: uncoveredMenus.sort(), uncoveredTables: uncoveredTables.sort() };
}

export function detectChanges() {
  if (!fs.existsSync(SRC_DIR)) {
    throw new Error(`Source directory not found: ${SRC_DIR}`);
  }
  const t0 = Date.now();
  const files = {};
  for (const r of WATCH_ROOTS) walkSources(path.join(SRC_DIR, r), r, files);
  for (const f of WATCH_SINGLE_FILES) {
    const abs = path.join(SRC_DIR, f);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const buf = fs.readFileSync(abs);
      let lines = 1;
      for (let i = 0; i < buf.length; i++) if (buf[i] === 10) lines++;
      files[f] = { sha: crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16), lines, bytes: buf.length };
    }
  }

  const head = gitReadOnly(SRC_DIR, ["rev-parse", "HEAD"]);
  const headShort = head.slice(0, 8);
  const headDate = gitReadOnly(SRC_DIR, ["show", "-s", "--format=%cI", "HEAD"]);
  const prevState = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : null;

  const addedFiles = [];
  const modifiedFiles = [];
  const deletedFiles = [];
  const changedFileDeltas = [];
  let newCommits = [];
  let mode = "incremental";

  if (prevState && prevState.files) {
    const prevFiles = prevState.files;
    for (const [rel, meta] of Object.entries(files)) {
      if (!prevFiles[rel]) {
        addedFiles.push(rel);
        changedFileDeltas.push({ file: rel, status: "added", prevLines: 0, lines: meta.lines, delta: meta.lines, bytesDelta: meta.bytes });
      } else if (prevFiles[rel].sha !== meta.sha) {
        modifiedFiles.push(rel);
        changedFileDeltas.push({
          file: rel,
          status: "modified",
          prevLines: prevFiles[rel].lines ?? 0,
          lines: meta.lines,
          delta: meta.lines - (prevFiles[rel].lines ?? 0),
          bytesDelta: meta.bytes - (prevFiles[rel].bytes ?? 0),
        });
      }
    }
    for (const rel of Object.keys(prevFiles)) {
      if (!files[rel]) {
        deletedFiles.push(rel);
        changedFileDeltas.push({ file: rel, status: "deleted", prevLines: prevFiles[rel].lines ?? 0, lines: 0, delta: -(prevFiles[rel].lines ?? 0), bytesDelta: -(prevFiles[rel].bytes ?? 0) });
      }
    }
    changedFileDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.file.localeCompare(b.file));
    if (prevState.sourceHead && prevState.sourceHead !== head) {
      const logOut = gitReadOnly(SRC_DIR, ["log", `${prevState.sourceHead}..HEAD`, "--date=iso", "--format=%h %ad %s"]);
      newCommits = logOut ? logOut.split(/\r?\n/).filter(Boolean) : [];
    }
  } else {
    // Bootstrap mode: diff since bcbrain's last vault commit instead of treating every file in repo as new
    mode = "bootstrap";
    const lastVaultDate = gitReadOnly(ROOT, ["log", "-n", "1", "--format=%cI", "--", "vault/"]) || "2026-11-17T10:00:00+07:00";
    const commitOut = gitReadOnly(SRC_DIR, ["log", `--since=${lastVaultDate}`, "--date=iso", "--format=%h %ad %s"]);
    newCommits = commitOut ? commitOut.split(/\r?\n/).filter(Boolean) : [];
    const committedPaths = gitReadOnly(SRC_DIR, ["log", `--since=${lastVaultDate}`, "--name-only", "--pretty=format:"])
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && isRelevantSourceRel(s));
    const dirtyOut = gitReadOnly(SRC_DIR, ["status", "--porcelain"]);
    const dirtyPaths = dirtyOut
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => l.slice(3).trim().replace(/^.* -> /, ""))
      .filter((s) => s && isRelevantSourceRel(s));
    const touched = [...new Set([...committedPaths, ...dirtyPaths])].sort();
    for (const rel of touched) {
      if (files[rel]) modifiedFiles.push(rel);
      else deletedFiles.push(rel);
    }
  }

  const changedFiles = [...new Set([...addedFiles, ...modifiedFiles, ...deletedFiles])].sort();
  const { sourceToNotes, brokenNotes, coveredMenus, coveredTables, vaultCount } = indexVaultSources(files);

  // Map changed source files -> impacted existing vault notes
  const impactedMap = new Map();
  for (const src of changedFiles) {
    for (const noteRel of sourceToNotes.get(src) ?? []) {
      let arr = impactedMap.get(noteRel);
      if (!arr) {
        arr = [];
        impactedMap.set(noteRel, arr);
      }
      arr.push(src);
    }
  }
  const impactedNotes = [...impactedMap.entries()]
    .map(([note, changedSources]) => ({ note, changedSources: changedSources.sort() }))
    .sort((a, b) => b.changedSources.length - a.changedSources.length || a.note.localeCompare(b.note));

  const uncoveredChangedFiles = changedFiles.filter((f) => !sourceToNotes.has(f) && files[f]);
  const { uncoveredMenus, uncoveredTables } = detectUncoveredEntities(coveredMenus, coveredTables);
  const menuParity = auditMenuCatalogParity(ROOT, SRC_DIR);
  const groundingDiff = summarizeGroundingDiff(diffGroundingLock(SRC_DIR));
  const diffStatOut = gitReadOnly(SRC_DIR, ["diff", "--stat=120,80", "HEAD", "--", ...WATCH_ROOTS]);
  const diffHighlights = diffStatOut ? diffStatOut.split(/\r?\n/).filter(Boolean).slice(0, 25) : [];

  const pendingCount = Array.isArray(prevState?.pendingNotes) ? prevState.pendingNotes.length : 0;
  const hasChanges =
    changedFiles.length > 0 ||
    brokenNotes.length > 0 ||
    newCommits.length > 0 ||
    menuParity.mismatchedFiles.length > 0 ||
    Boolean(groundingDiff?.hasDrift) ||
    pendingCount > 0;

  return {
    mode,
    checkedAt: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    sourceDir: SRC_DIR,
    sourceHead: head,
    sourceHeadShort: headShort,
    sourceHeadDate: headDate,
    trackedSourceCount: Object.keys(files).length,
    vaultNoteCount: vaultCount,
    hasChanges,
    pendingCount,
    menuParityMismatches: menuParity.mismatchedFiles,
    groundingDiff,
    diffHighlights,
    newCommits,
    addedFiles,
    modifiedFiles,
    deletedFiles,
    changedFileDeltas,
    brokenNotes,
    impactedNotes,
    uncoveredChangedFiles,
    uncoveredMenus,
    uncoveredTables,
    snapshot: {
      sourceHead: head,
      sourceHeadShort: headShort,
      capturedAt: new Date().toISOString(),
      files,
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = detectChanges();
  if (process.argv.includes("--json")) {
    const { snapshot, ...summary } = report;
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `detect-changes (${report.mode}) in ${report.elapsedMs}ms | head=${report.sourceHeadShort} | tracked=${report.trackedSourceCount} files | vault=${report.vaultNoteCount} notes`,
    );
    console.log(
      `hasChanges=${report.hasChanges} | commits=${report.newCommits.length} | added=${report.addedFiles.length} modified=${report.modifiedFiles.length} deleted=${report.deletedFiles.length}`,
    );
    console.log(`brokenNotes=${report.brokenNotes.length} | impactedNotes=${report.impactedNotes.length} | uncoveredChanged=${report.uncoveredChangedFiles.length}`);
    console.log(
      `uncoveredMenus=${report.uncoveredMenus.length} | uncoveredTables=${report.uncoveredTables.length} | groundingLock=${report.groundingDiff?.hasLock ? (report.groundingDiff.hasDrift ? "DRIFT" : "clean") : "none"}`,
    );
    if (report.brokenNotes.length) {
      console.log("\nBroken source references:");
      for (const b of report.brokenNotes.slice(0, 15)) console.log(`  - ${b.note}: ${b.issues.join("; ")}`);
    }
    if (report.newCommits.length) {
      console.log("\nNew commits:");
      for (const c of report.newCommits.slice(0, 15)) console.log(`  - ${c}`);
    }
    if (report.impactedNotes.length) {
      console.log("\nTop impacted vault notes:");
      for (const n of report.impactedNotes.slice(0, 20)) {
        console.log(`  - ${n.note} (${n.changedSources.length} changed: ${n.changedSources.slice(0, 3).join(", ")})`);
      }
    }
  }
}
