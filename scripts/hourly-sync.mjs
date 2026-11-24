// Hourly autonomous BC Brain sync & auto-deploy orchestrator.
// IRON INVARIANTS:
//   1. STRICTLY READ-ONLY on D:/bcaiaccount — extractors are never granted write/edit/bash permissions on D:/bcaiaccount.
//   2. ZERO HALLUCINATION — every updated/created note must pass all 7 verification gates before deploy.
//   3. ATOMIC ROLLBACK — any gate failure restores vault/ cleanly and aborts deploy; live prod eval failure rolls back server.
// Usage:
//   node scripts/hourly-sync.mjs --plan-only [--json]        (detect changes + prioritize target notes in <1s)
//   node scripts/hourly-sync.mjs --finalize [--no-deploy]    (run all 7 gates + deploy + update .sync-state.json)
//   node scripts/hourly-sync.mjs [--dry-run] [--no-deploy]   (unattended standalone check + extract + 7 gates + deploy)
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { detectChanges } from "./detect-changes.mjs";
import { saveGroundingLock } from "./grounding-lock.mjs";
import { loadBcMenuTruth, loadLocalEnv, redactLogText } from "./load-env.mjs";
import { computeIncrementalDiffs, saveBaselineSnapshot } from "./sync-cache.mjs";

loadLocalEnv();

const ROOT = process.cwd();
const VAULT_DIR = path.join(ROOT, "vault");
const SRC_DIR = path.resolve(process.env.BC_SOURCE_DIR ?? "D:/bcaiaccount");
const STATE_FILE = path.join(ROOT, ".sync-state.json");
const LOCK_FILE = path.join(ROOT, ".sync.lock");
const LOG_DIR = path.join(ROOT, ".sync-logs");
const LOG_FILE = path.join(LOG_DIR, "hourly.log");
const META_FILE = path.join(ROOT, "public", "sync-meta.json");

const DRY_RUN = process.argv.includes("--dry-run");
const PLAN_ONLY = process.argv.includes("--plan-only");
const FINALIZE_ONLY = process.argv.includes("--finalize");
const RECORD_NOOP = process.argv.includes("--record-noop");
const JSON_OUT = process.argv.includes("--json");
const DIFF_OUT = process.argv.includes("--diff");
const VERBOSE_OUT = process.argv.includes("--verbose");
const NO_DEPLOY = process.argv.includes("--no-deploy");
const FORCE = process.argv.includes("--force");
const argNum = (flag, fallback) => {
  const idx = process.argv.indexOf(flag);
  const v = idx !== -1 ? Number(process.argv[idx + 1]) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
};
const MAX_BATCHES = argNum("--max-batches", Number(process.env.BC_SYNC_MAX_BATCHES ?? 3));
const BATCH_SIZE = argNum("--batch-size", Number(process.env.BC_SYNC_BATCH_SIZE ?? 2));
const MODEL = process.env.BC_SYNC_MODEL ?? "sonnet";
const FALLBACK_MODEL = process.env.BC_SYNC_FALLBACK_MODEL ?? "opus";
const MAX_BUDGET = process.env.BC_SYNC_MAX_BUDGET_USD ?? "1.50";
const STALE_LOCK_MS = 45 * 60 * 1000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${redactLogText(msg)}`;
  console.log(line);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
}

function rotateLogIfLarge() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    if (fs.statSync(LOG_FILE).size > 1024 * 1024) {
      const lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").slice(-500);
      fs.writeFileSync(LOG_FILE, lines.join("\n") + "\n", "utf8");
    }
  } catch {
    // ignore
  }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const cur = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      const age = Date.now() - (cur.startedAt ?? 0);
      if (age < STALE_LOCK_MS && cur.pid && isPidAlive(cur.pid)) {
        log(`SKIP: another sync is active (pid=${cur.pid}, age=${Math.round(age / 1000)}s)`);
        process.exit(0);
      }
    } catch {
      // corrupt lock -> replace
    }
    fs.rmSync(LOCK_FILE, { force: true });
  }
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: Date.now() }), "utf8");
}

function releaseLock() {
  try {
    fs.rmSync(LOCK_FILE, { force: true });
  } catch {
    // ignore
  }
}

function resolveClaudeBin() {
  const candidates = [
    path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe"),
    path.join(process.env.USERPROFILE ?? "", ".local", "bin", "claude.exe"),
  ];
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return "claude";
}

function listAllSlugs() {
  const slugs = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(".md")) slugs.push(path.basename(e.name, ".md").toLowerCase());
    }
  };
  walk(VAULT_DIR);
  return slugs.sort();
}

function gitCommittedSourcesSince(report) {
  // Files modified in recent git commits get top priority over noisy working-tree edits
  try {
    const prevState = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : null;
    const args = prevState?.sourceHead
      ? ["--no-optional-locks", "-C", SRC_DIR, "diff", "--name-only", prevState.sourceHead, "HEAD"]
      : ["--no-optional-locks", "-C", SRC_DIR, "log", "-n", "12", "--name-only", "--pretty=format:"];
    const out = execFileSync("git", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 10000 });
    return new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function selectTargetNotes(report) {
  const committedFiles = gitCommittedSourcesSince(report);
  const scored = new Map();

  // Priority 1: Broken source references (EOF / missing file) & shifted menu catalogs — always heal first
  for (const b of report.brokenNotes) {
    scored.set(b.note, {
      note: b.note,
      priority: 1000,
      reasons: b.issues,
      changedSources: [],
    });
  }
  for (const mm of report.menuParityMismatches ?? []) {
    const prev = scored.get(mm.note);
    const reason = `menu catalog parity mismatch (${mm.issues.length} issue(s): ${mm.issues[0] ?? ""})`;
    if (prev) {
      prev.priority += 950;
      prev.reasons.push(reason);
      prev.changedSources = [...new Set([...prev.changedSources, "frontend/src/config/bcMenu.json"])];
    } else {
      scored.set(mm.note, {
        note: mm.note,
        priority: 950,
        reasons: [reason],
        changedSources: ["frontend/src/config/bcMenu.json"],
      });
    }
  }

  // Priority 2: Notes impacted by recent commits or modified source files
  for (const imp of report.impactedNotes) {
    const commitHits = imp.changedSources.filter((s) => committedFiles.has(s));
    const score = commitHits.length * 100 + imp.changedSources.length * 10;
    const prev = scored.get(imp.note);
    if (prev) {
      prev.priority += score;
      prev.changedSources = [...new Set([...prev.changedSources, ...imp.changedSources])];
    } else {
      scored.set(imp.note, {
        note: imp.note,
        priority: score,
        reasons: commitHits.length ? [`${commitHits.length} committed source file(s) changed`] : [`${imp.changedSources.length} source file(s) changed`],
        changedSources: imp.changedSources,
      });
    }
  }

  // Priority 3: Uncovered newly added 4-digit menus -> route to matching menu-cat-N-*.md catalog
  if (report.uncoveredMenus.length) {
    const catFileMap = {
      "1": "vault/start/menu-cat-1-setup.md",
      "2": "vault/start/menu-cat-2-stock.md",
      "3": "vault/start/menu-cat-3-purchase.md",
      "4": "vault/start/menu-cat-4-sales.md",
      "5": "vault/start/menu-cat-5-ap.md",
      "6": "vault/start/menu-cat-6-ar.md",
      "7": "vault/start/menu-cat-7-cash-bank.md",
      "8": "vault/start/menu-cat-8-fixed-assets.md",
      "9": "vault/start/menu-cat-9-gl.md",
    };
    const byCat = new Map();
    for (const m of report.uncoveredMenus) {
      const cat = m[0];
      const target = catFileMap[cat];
      if (!target || !fs.existsSync(path.join(ROOT, target))) continue;
      if (!byCat.has(target)) byCat.set(target, []);
      byCat.get(target).push(m);
    }
    for (const [noteRel, menus] of byCat) {
      const prev = scored.get(noteRel);
      const reason = `new menus in bcMenu.json not yet in catalog: ${menus.slice(0, 6).join(", ")}`;
      if (prev) {
        prev.priority += 400;
        prev.reasons.push(reason);
        prev.changedSources = [...new Set([...prev.changedSources, "frontend/src/config/bcMenu.json"])];
      } else {
        scored.set(noteRel, {
          note: noteRel,
          priority: 400,
          reasons: [reason],
          changedSources: ["frontend/src/config/bcMenu.json"],
        });
      }
    }
  }

  // Carry over any pending notes from a previous large burst
  const prevState = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : null;
  for (const pending of prevState?.pendingNotes ?? []) {
    if (!fs.existsSync(path.join(ROOT, pending.note))) continue;
    if (!scored.has(pending.note)) {
      scored.set(pending.note, {
        note: pending.note,
        priority: 50,
        reasons: ["queued from previous burst"],
        changedSources: pending.changedSources ?? [],
      });
    }
  }

  return [...scored.values()].sort((a, b) => b.priority - a.priority || a.note.localeCompare(b.note));
}

const EXTRACTION_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    updates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          reason: { type: "string" },
          content: { type: "string" },
        },
        required: ["relativePath", "reason", "content"],
      },
    },
    skipped: {
      type: "array",
      items: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          reason: { type: "string" },
        },
        required: ["relativePath", "reason"],
      },
    },
  },
  required: ["updates", "skipped"],
});

function callReadOnlyExtractor(prompt) {
  const claudeBin = resolveClaudeBin();
  const args = [
    "-p",
    prompt,
    "--model",
    MODEL,
    "--fallback-model",
    FALLBACK_MODEL,
    "--tools",
    "Read,Glob,Grep",
    "--allowedTools",
    "Read,Glob,Grep",
    "--add-dir",
    SRC_DIR,
    "--permission-mode",
    "dontAsk",
    "--strict-mcp-config",
    "--mcp-config",
    JSON.stringify({ mcpServers: {} }),
    "--no-session-persistence",
    "--disable-slash-commands",
    "--max-budget-usd",
    String(MAX_BUDGET),
    "--output-format",
    "json",
    "--json-schema",
    EXTRACTION_SCHEMA,
  ];
  const res = spawnSync(claudeBin, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 240_000,
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });
  if (res.status !== 0) {
    throw new Error(`extractor failed (exit ${res.status}): ${redactLogText((res.stderr || res.stdout || "").slice(-800))}`);
  }
  const parsed = JSON.parse(res.stdout);
  if (parsed.is_error || !parsed.structured_output) {
    throw new Error(`extractor returned error: ${redactLogText(String(parsed.result ?? "").slice(0, 400))}`);
  }
  return {
    output: parsed.structured_output,
    costUsd: parsed.total_cost_usd ?? 0,
  };
}

function buildBatchPrompt(batch, report, allSlugs) {
  const briefPath = path.join(ROOT, "docs", "extract-brief.md");
  const menuTruth = loadBcMenuTruth(SRC_DIR);
  const newMenuLines = report.uncoveredMenus
    .slice(0, 15)
    .map((m) => {
      const code = m.slice(0, 4);
      const info = menuTruth.get(code);
      return info ? `- ${info.code}: ${info.path}` : `- ${m}`;
    })
    .join("\n");

  const itemsText = batch
    .map((item, idx) => {
      const srcWithLines = item.changedSources.slice(0, 8).map((s) => {
        const meta = report.snapshot.files[s];
        return meta ? `${s} (${meta.lines} lines)` : `${s} (deleted/missing)`;
      });
      return [
        `${idx + 1}. Target note: ${item.note}`,
        `   Reasons: ${item.reasons.join(" | ")}`,
        `   Changed source files in D:/bcaiaccount: ${srcWithLines.join(", ") || "(check note sources frontmatter)"}`,
      ].join("\n");
    })
    .join("\n");

  return `You are the strictly READ-ONLY BC Brain Knowledge Extractor updating vault notes in D:/bcbrain/vault/.

ABSOLUTE RULES (ZERO HALLUCINATION, ZERO VIOLATIONS):
1. First read D:/bcbrain/docs/extract-brief.md and each target note in D:/bcbrain/vault/, then read the ACTUAL changed files in D:/bcaiaccount/.
2. NEVER invent menu codes, SQL table names, column names, buttons, prices, or line numbers. Every single fact must come verbatim from files you actually Read in D:/bcaiaccount/.
3. For every frontmatter \`sources:\` entry \`path:start-end\`, verify the file exists in D:/bcaiaccount/ (or D:/bcaiwebsite-live/ for \`bcaiwebsite-live/...\`) and \`1 <= start <= end <= actual_EOF_lines\`. If a file was split/refactored (e.g. bcI18n.tsx), update \`sources:\` to the exact current files and valid line ranges.
4. AUDIENCE ISOLATION & CALL-CENTER / SALES HUMAN-LANGUAGE RULE:
   - User-zone folders (\`start\`, \`howto\`, \`troubleshoot\`, \`faq\`, \`reports\`, \`systems\`, \`glossary\`, \`sales\`): Plain, easy-to-understand Thai ONLY. ZERO \`snake_case\` identifiers, ZERO \`.go/.tsx/.ts/.sql\` filenames, ZERO \`/api/\`, ZERO \`SELECT/INSERT/UPDATE/trans_flag/React/Next.js/Golang/Postgres/Gemini\`, ZERO backticks around English code tokens (both in body AND in \`aliases\`). Preserve existing verified https://bcaccount.com/... image links and YouTube links!
   - **Call Center & Sales Human-Language Coverage (MANDATORY for user-zone notes)**: Write so AI Call Center and Sales teams can answer real customers immediately without jargon. Expand frontmatter \`aliases\` to 6–15 natural Thai spoken/chat phrases customers actually ask (e.g. "บิลผิดแก้ยังไง", "ขายแล้วสต็อกไม่ตัด", "ใช้กับร้าน...ได้ไหม", "รองรับ...ไหม", not just formal menu names). Include exact Thai on-screen error messages verbatim (for \`lookup_error\`), step-by-step screen instructions (menu/button/field names), business benefits & honest current limitations (for pre-sales), and a concise \`## คำถามที่ลูกค้ามักถาม\` Q&A block when helpful — while keeping 100% of facts grounded in real code in \`D:/bcaiaccount/\`.
   - Dev-zone folders (\`dev-playbook\`, \`schema\`, \`queries\`, \`api\`, \`doctypes\`, \`architecture\`): Accurate technical Thai+English specs, PostgreSQL NUMERIC (never float/double), \`COALESCE(last_status, 0) = 0\` on transaction queries, exact table/column/handler names from code.
5. FORBIDDEN SECURITY (ALL FOLDERS): NEVER mention auth/token tables (\`bc_user_list\`, \`bc_mcp_access_tokens\`, \`bc_mcp_token_databases\`, \`bc_mcp_token_audit\`, \`bc_google_account\`, \`pg_shadow\`, \`pg_authid\`, \`password_hash\`, \`bcrypt\`), secrets, emails, or public IPs.
6. WIKILINKS: Every \`[[slug]]\` or \`[[rel::slug]]\` MUST point to an existing slug from this exact valid list (NEVER invent non-existent slugs):
${allSlugs.join(", ")}
7. MINIMAL ACCURATE UPDATE: Keep all existing accurate sections, media links, and structure intact! Only update sections that actually changed or fix broken \`sources:\` ranges. If after reading the actual code you confirm a note has NO meaningful behavioral or source-range change, put it in \`skipped\` instead of rewriting it unnecessarily.
8. Return complete valid markdown (including \`---\` YAML frontmatter with title, tags, aliases, sources) in \`updates[].content\`.

Recent commits in D:/bcaiaccount:
${report.newCommits.slice(0, 12).map((c) => `- ${c}`).join("\n") || "(working tree changes only)"}

${newMenuLines ? `New menus in bcMenu.json not yet listed in vault:\n${newMenuLines}\n` : ""}
Target notes to inspect & update in this batch:
${itemsText}

Remember: Read ${briefPath} and the real source files before generating JSON output.`;
}

function buildRepairPrompt(errorOutput, touchedPaths, allSlugs) {
  return `Your previous vault update failed strict anti-hallucination/lint validation. Fix ONLY the failing notes listed below by reading the current vault files in D:/bcbrain/ and real source files in D:/bcaiaccount/.

Validation errors to fix:
${errorOutput}

Notes you are allowed to fix:
${touchedPaths.join("\n")}

Valid existing wikilink slugs:
${allSlugs.join(", ")}

Rules:
- Fix every single error above without dropping accurate content.
- Keep user-zone notes 100% free of snake_case, file extensions, /api/, SQL/tech terms, or backticked code identifiers (including in aliases).
- Ensure every \`sources:\` path exists and line range is within actual EOF.
- Return updated full markdown files in \`updates\`.`;
}

function applyValidatedUpdates(updates, backups) {
  const written = [];
  const vaultAbs = path.resolve(VAULT_DIR) + path.sep;
  for (const u of updates ?? []) {
    const rel = String(u.relativePath ?? "").replace(/\\/g, "/").replace(/^\.\//, "");
    if (!rel.startsWith("vault/") || !rel.endsWith(".md") || rel.includes("..")) {
      throw new Error(`Rejected unsafe path from extractor: ${rel}`);
    }
    const base = path.basename(rel, ".md");
    if (!/^[a-z0-9-]+$/.test(base)) {
      throw new Error(`Rejected non-kebab slug from extractor: ${rel}`);
    }
    const abs = path.resolve(ROOT, rel);
    if (!abs.startsWith(vaultAbs)) {
      throw new Error(`Path escapes vault directory: ${rel}`);
    }
    const content = String(u.content ?? "").replace(/\r\n/g, "\n");
    if (!content.startsWith("---\n") || content.length < 150) {
      throw new Error(`Rejected malformed/empty note content for ${rel}`);
    }
    if (fs.existsSync(abs)) {
      const prev = fs.readFileSync(abs, "utf8");
      if (!backups.has(abs)) backups.set(abs, prev);
      if (prev.length > 600 && content.length < prev.length * 0.55) {
        throw new Error(`Shrink guard rejected ${rel}: ${prev.length} -> ${content.length} chars`);
      }
    } else if (!backups.has(abs)) {
      backups.set(abs, null); // null = newly created -> delete on rollback
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content.endsWith("\n") ? content : content + "\n", "utf8");
    written.push({ rel, reason: u.reason });
  }
  return written;
}

function rollbackBackups(backups) {
  for (const [abs, prev] of backups) {
    if (prev === null) fs.rmSync(abs, { force: true });
    else fs.writeFileSync(abs, prev, "utf8");
  }
}

function runGate(label, bin, args) {
  const res = spawnSync(bin, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 180_000,
    shell: false,
  });
  return {
    ok: res.status === 0,
    label,
    output: redactLogText(`${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim()),
  };
}

function runGates1to3(touchedRels) {
  const g1 = runGate("check-notes --strict", process.execPath, ["scripts/check-notes.mjs", SRC_DIR, "--strict"]);
  if (!g1.ok) return g1;
  const g2 = runGate("scan-secrets", process.execPath, ["scripts/scan-secrets.mjs"]);
  if (!g2.ok) return g2;
  const g3Args = touchedRels.length
    ? ["scripts/verify-grounding.mjs", "--files", touchedRels.join(",")]
    : ["scripts/verify-grounding.mjs"];
  const g3 = runGate("verify-grounding", process.execPath, g3Args);
  if (!g3.ok) return g3;
  return { ok: true, label: "gates 1-3", output: "all passed" };
}

function runGates4to6() {
  const tscBin = process.platform === "win32" ? "cmd.exe" : "npx";
  const tscArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npx tsc --noEmit"] : ["tsc", "--noEmit"];
  const g4 = runGate("tsc --noEmit", tscBin, tscArgs);
  if (!g4.ok) return g4;
  const g5 = runGate("selftest", process.execPath, ["scripts/selftest.ts"]);
  if (!g5.ok) return g5;
  const g6 = runGate("deep-test", process.execPath, ["scripts/deep-test.ts"]);
  if (!g6.ok) return g6;
  return { ok: true, label: "gates 4-6", output: "all passed" };
}

function writeSyncMeta(report, updatedCount) {
  // Read live graph stats cleanly via selftest/node without duplicating parser
  let noteCount = report.vaultNoteCount;
  let synapseCount = 0;
  try {
    const out = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import fs from "node:fs"; import { registerHooks } from "node:module"; import { fileURLToPath } from "node:url";
         registerHooks({ resolve(s, c, n) { if (s.startsWith(".") && !s.endsWith(".ts") && c.parentURL?.startsWith("file:")) { const u = new URL(s + ".ts", c.parentURL); if (fs.existsSync(fileURLToPath(u))) return { url: u.href, shortCircuit: true }; } return n(s, c); } });
         const { graph } = await import("./lib/vault.ts");
         const g = graph("all"); console.log(JSON.stringify({ nodes: g.nodes.length, links: g.links.length }));`,
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 30_000 },
    ).trim();
    const parsed = JSON.parse(out);
    noteCount = parsed.nodes;
    synapseCount = parsed.links;
  } catch {
    // fallback to detected count
  }
  const meta = {
    syncedAt: new Date().toISOString(),
    sourceCommit: report.sourceHeadShort,
    noteCount,
    synapseCount,
    lastUpdatedNotes: updatedCount,
  };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + "\n", "utf8");
  return meta;
}

function listModifiedVaultFiles() {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", "vault/"], { cwd: ROOT, encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => l.slice(3).trim().replace(/^.* -> /, ""))
      .filter((p) => p.startsWith("vault/") && p.endsWith(".md") && fs.existsSync(path.join(ROOT, p)));
  } catch {
    return [];
  }
}

function listModifiedBrainCodeFiles() {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", "lib/", "app/", "scripts/"], { cwd: ROOT, encoding: "utf8" });
    return out.split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function maybeCommitVaultLocally(report, updatedRels) {
  if (!updatedRels.length) return;
  try {
    // Never disturb unrelated staged changes
    const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (staged) {
      log("git: skipped auto-commit because unrelated staged changes exist");
      return;
    }
    execFileSync("git", ["add", "--", ...updatedRels, "public/sync-meta.json"], { cwd: ROOT, stdio: "pipe" });
    const nowStaged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, encoding: "utf8" }).trim();
    if (!nowStaged) return;
    const msg = `chore(vault): hourly auto-sync from bcaiaccount@${report.sourceHeadShort} (${updatedRels.length} notes)`;
    execFileSync("git", ["commit", "-m", msg], { cwd: ROOT, stdio: "pipe" });
    log(`git: committed locally -> ${msg}`);
  } catch (e) {
    log(`git: auto-commit skipped (${redactLogText(e.message)})`);
  }
}

async function main() {
  rotateLogIfLarge();
  if (PLAN_ONLY) {
    const report = detectChanges();
    const targets = selectTargetNotes(report);
    const maxNotes = MAX_BATCHES * BATCH_SIZE;
    const selected = targets.slice(0, maxNotes);
    const remainingPending = targets
      .slice(maxNotes)
      .filter((t) => t.priority >= 100)
      .slice(0, 24)
      .map((t) => ({ note: t.note, changedSources: t.changedSources }));
    const { snapshot, ...summary } = report;
    if (JSON_OUT) {
      if (VERBOSE_OUT) {
        console.log(JSON.stringify({ ...summary, selected, pendingAfterBatch: remainingPending.length }, null, 2));
      } else if (!report.hasChanges) {
        console.log(
          JSON.stringify({
            hasChanges: false,
            mode: report.mode,
            sourceHeadShort: report.sourceHeadShort,
            trackedSourceCount: report.trackedSourceCount,
            vaultNoteCount: report.vaultNoteCount,
            elapsedMs: report.elapsedMs,
          }),
        );
      } else {
        const compact = {
          hasChanges: true,
          mode: report.mode,
          sourceHeadShort: report.sourceHeadShort,
          sourceHeadDate: report.sourceHeadDate,
          elapsedMs: report.elapsedMs,
          trackedSourceCount: report.trackedSourceCount,
          vaultNoteCount: report.vaultNoteCount,
          pendingCount: report.pendingCount,
          impactedCount: report.impactedNotes.length,
          uncoveredTableCount: report.uncoveredTables.length,
          ...(report.newCommits.length ? { newCommits: report.newCommits.slice(0, 10) } : {}),
          ...(report.changedFileDeltas?.length ? { changedFileDeltas: report.changedFileDeltas } : { modifiedFiles: report.modifiedFiles }),
          ...(report.brokenNotes.length ? { brokenNotes: report.brokenNotes } : {}),
          ...(report.menuParityMismatches.length ? { menuParityMismatches: report.menuParityMismatches } : {}),
          ...(report.uncoveredMenus.length ? { uncoveredMenus: report.uncoveredMenus.slice(0, 15) } : {}),
          ...(report.uncoveredChangedFiles.length ? { uncoveredChangedFiles: report.uncoveredChangedFiles } : {}),
          ...(report.groundingDiff?.hasDrift || (DIFF_OUT && report.groundingDiff) ? { groundingDiff: report.groundingDiff } : {}),
          ...(DIFF_OUT && report.changedFileDeltas?.length ? { diffs: computeIncrementalDiffs(SRC_DIR, report.changedFileDeltas) } : {}),
          selected,
          pendingAfterBatch: remainingPending.length,
        };
        console.log(JSON.stringify(compact));
      }
    } else {
      console.log(`plan-only (${report.mode}): head=${report.sourceHeadShort} hasChanges=${report.hasChanges} selected=${selected.length}/${targets.length}`);
      for (const s of selected) console.log(`  -> ${s.note} [pri=${s.priority}] (${s.reasons[0] ?? ""})`);
    }
    return;
  }

  acquireLock();
  const t0 = Date.now();
  const backups = new Map();

  try {
    const report = detectChanges();
    log(
      `CHECK (${report.mode}): head=${report.sourceHeadShort} tracked=${report.trackedSourceCount} hasChanges=${report.hasChanges} commits=${report.newCommits.length} mod=${report.modifiedFiles.length} broken=${report.brokenNotes.length} impacted=${report.impactedNotes.length} uncoveredMenus=${report.uncoveredMenus.length}`,
    );

    if (FINALIZE_ONLY) {
      const modifiedVault = listModifiedVaultFiles();
      const modifiedCodeCount = listModifiedBrainCodeFiles();
      log(`FINALIZE: dirtyVault=${modifiedVault.length} dirtyCode=${modifiedCodeCount}`);

      const gate13 = runGates1to3(modifiedVault);
      if (!gate13.ok) {
        throw new Error(`Gate failed (${gate13.label}):\n${gate13.output.slice(0, 1500)}`);
      }
      log("GATES 1-3 OK (check-notes --strict, scan-secrets, verify-grounding)");

      const gate46 = runGates4to6();
      if (!gate46.ok) {
        throw new Error(`Gate failed (${gate46.label}):\n${gate46.output.slice(0, 1500)}`);
      }
      log("GATES 4-6 OK (tsc --noEmit, selftest, deep-test)");

      if (modifiedVault.length > 0 || modifiedCodeCount > 0 || FORCE) {
        const meta = writeSyncMeta(report, modifiedVault.length);
        log(`META: nodes=${meta.noteCount} synapses=${meta.synapseCount} commit=${meta.sourceCommit}`);
        if (!NO_DEPLOY) {
          log("GATE 7: deploying atomically to production + running live mcp-eval...");
          const dep = runGate("deploy.mjs", process.execPath, ["scripts/deploy.mjs"]);
          if (!dep.ok) throw new Error(`Deploy failed:\n${dep.output.slice(-1500)}`);
          log(dep.output.split("\n").slice(-6).join(" | "));
        } else {
          log("GATE 7 skipped (--no-deploy)");
        }
        maybeCommitVaultLocally(report, modifiedVault);
      } else {
        log("FINALIZE: zero vault/code changes — skipped rebuild/deploy");
      }

      const targets = selectTargetNotes(report);
      const untouchedSet = new Set(modifiedVault);
      const remainingPending = targets
        .filter((t) => !untouchedSet.has(t.note) && t.priority >= 150)
        .slice(0, 24)
        .map((t) => ({ note: t.note, changedSources: t.changedSources }));
      const nextState = {
        ...report.snapshot,
        lastSyncedAt: new Date().toISOString(),
        lastUpdatedNotes: modifiedVault,
        pendingNotes: remainingPending,
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(nextState), "utf8");
      const snap = saveBaselineSnapshot(SRC_DIR, report.snapshot.files);
      const glock = saveGroundingLock(SRC_DIR);
      log(
        `FINALIZE DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s (updated=${modifiedVault.length}, pending=${remainingPending.length}, cache=${snap.cachedFiles}f/${(snap.gzBytes / 1024).toFixed(0)}KB, lock=${glock.menusCount}m/${glock.sqlTableCount}t/${glock.sqlColumnCount}c/${glock.errorStringsCount}e)`,
      );
      return;
    }

    if (RECORD_NOOP) {
      const gate13 = runGates1to3([]);
      if (!gate13.ok) throw new Error(`Cannot record noop — Gate failed (${gate13.label}):\n${gate13.output.slice(0, 1200)}`);
      const nextState = {
        ...report.snapshot,
        lastSyncedAt: new Date().toISOString(),
        lastUpdatedNotes: [],
        pendingNotes: [],
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(nextState), "utf8");
      const snap = saveBaselineSnapshot(SRC_DIR, report.snapshot.files);
      const glock = saveGroundingLock(SRC_DIR);
      log(
        `RECORD-NOOP: Gates 1-3 clean, .sync-state.json, baseline cache (${snap.cachedFiles}f) & grounding.lock.json (${glock.menusCount}m/${glock.sqlTableCount}t/${glock.sqlColumnCount}c) updated`,
      );
      return;
    }

    if (!report.hasChanges && !FORCE) {
      log(`NOOP: D:/bcaiaccount unchanged (${report.elapsedMs}ms)`);
      return;
    }

    const targets = selectTargetNotes(report);
    const maxNotes = MAX_BATCHES * BATCH_SIZE;
    const selected = targets.slice(0, maxNotes);
    const remainingPending = targets
      .slice(maxNotes)
      .filter((t) => t.priority >= 100)
      .slice(0, 24)
      .map((t) => ({
        note: t.note,
        changedSources: t.changedSources,
      }));

    log(`PLAN: selected ${selected.length}/${targets.length} priority notes (${Math.ceil(selected.length / BATCH_SIZE)} batches, pending=${remainingPending.length})`);
    for (const s of selected) {
      log(`  -> ${s.note} [pri=${s.priority}] (${s.reasons[0] ?? ""})`);
    }

    if (DRY_RUN) {
      log("DRY-RUN complete (no edits, no deploy)");
      return;
    }

    const allSlugs = listAllSlugs();
    const touchedRels = new Set();
    let totalCost = 0;

    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      log(`EXTRACT batch ${batchNum}: ${batch.map((b) => b.note).join(", ")}`);
      const prompt = buildBatchPrompt(batch, report, allSlugs);
      const { output, costUsd } = callReadOnlyExtractor(prompt);
      totalCost += costUsd;
      const written = applyValidatedUpdates(output.updates, backups);
      for (const w of written) {
        touchedRels.add(w.rel);
        log(`  UPDATED ${w.rel}: ${w.reason}`);
      }
      for (const sk of output.skipped ?? []) {
        log(`  SKIPPED ${sk.relativePath}: ${sk.reason}`);
      }
    }

    const updatedList = [...touchedRels];
    log(`EXTRACT done: ${updatedList.length} note(s) updated, est cost=$${totalCost.toFixed(4)}`);

    // Gates 1-3 with 1 automatic self-repair retry if needed
    let gate13 = runGates1to3(updatedList);
    if (!gate13.ok && updatedList.length > 0) {
      log(`REPAIR: ${gate13.label} failed — running 1 targeted self-repair pass...`);
      log(gate13.output.slice(0, 1000));
      const repairPrompt = buildRepairPrompt(gate13.output, updatedList, listAllSlugs());
      const { output: repOut, costUsd: repCost } = callReadOnlyExtractor(repairPrompt);
      totalCost += repCost;
      const repWritten = applyValidatedUpdates(repOut.updates, backups);
      for (const w of repWritten) {
        touchedRels.add(w.rel);
        log(`  REPAIRED ${w.rel}: ${w.reason}`);
      }
      gate13 = runGates1to3([...touchedRels]);
    }
    if (!gate13.ok) {
      throw new Error(`Gate failed (${gate13.label}):\n${gate13.output.slice(0, 1500)}`);
    }
    log("GATES 1-3 OK (check-notes --strict, scan-secrets, verify-grounding)");

    // Gates 4-6
    const gate46 = runGates4to6();
    if (!gate46.ok) {
      throw new Error(`Gate failed (${gate46.label}):\n${gate46.output.slice(0, 1500)}`);
    }
    log("GATES 4-6 OK (tsc --noEmit, selftest, deep-test)");

    const finalUpdated = [...touchedRels];
    const shouldDeploy = finalUpdated.length > 0 || FORCE;
    if (shouldDeploy) {
      const meta = writeSyncMeta(report, finalUpdated.length);
      log(`META: nodes=${meta.noteCount} synapses=${meta.synapseCount} commit=${meta.sourceCommit}`);
      if (!NO_DEPLOY) {
        log("GATE 7: deploying atomically to production + running live mcp-eval...");
        const dep = runGate("deploy.mjs", process.execPath, ["scripts/deploy.mjs"]);
        if (!dep.ok) {
          throw new Error(`Deploy failed:\n${dep.output.slice(-1500)}`);
        }
        log(dep.output.split("\n").slice(-6).join(" | "));
      } else {
        log("GATE 7 skipped (--no-deploy)");
      }
      maybeCommitVaultLocally(report, finalUpdated);
    } else {
      log("SYNC: all inspected notes were already accurate — skipped rebuild/deploy");
    }

    // Save verified state snapshot so next hour is a <1s NOOP unless D:/bcaiaccount changes again
    const nextState = {
      ...report.snapshot,
      lastSyncedAt: new Date().toISOString(),
      lastUpdatedNotes: finalUpdated,
      pendingNotes: remainingPending,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState), "utf8");
    const snap = saveBaselineSnapshot(SRC_DIR, report.snapshot.files);
    const glock = saveGroundingLock(SRC_DIR);
    log(
      `DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s (updated=${finalUpdated.length}, pending=${remainingPending.length}, cost=$${totalCost.toFixed(4)}, cache=${snap.cachedFiles}f, lock=${glock.menusCount}m/${glock.sqlTableCount}t/${glock.sqlColumnCount}c)`,
    );
  } catch (err) {
    rollbackBackups(backups);
    log(`ABORT & ROLLED BACK: ${err.message}`);
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

await main();
