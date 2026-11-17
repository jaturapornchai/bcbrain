// Lint the dual-audience vault: frontmatter, unique lowercase slugs, real `sources`, no broken [[links]],
// strict user-folder jargon check (excluding playbooks & dev folders), and FORBIDDEN_SECURITY across all folders.
// Usage: node scripts/check-notes.mjs [path-to-bcaiaccount] [--strict] [--drift] [--fail-on-drift]
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const args = process.argv.slice(2);
const strictJargon = args.includes("--strict") || process.env.STRICT_JARGON === "1";
const checkDrift = args.includes("--drift");
const failOnDrift = args.includes("--fail-on-drift");
const srcArg = args.find((a) => !a.startsWith("--"));
const VAULT = path.join(process.cwd(), "vault");
const SRC = srcArg ?? "D:/bcaiaccount";
const WEB_SRC = process.env.BC_WEBSITE_SRC ?? "D:/bcaiwebsite-live";
const hasSrc = fs.existsSync(SRC);
const hasWebSrc = fs.existsSync(WEB_SRC);

function walk(d) {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".")) return [];
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : e.isFile() && e.name.endsWith(".md") ? [p] : [];
  });
}

// Strict jargon check for user-facing content folders (NOT run on playbook/ or dev folders)
const USER_JARGON_FOLDERS = new Set([
  "start",
  "howto",
  "troubleshoot",
  "faq",
  "reports",
  "systems",
  "glossary",
  "sales",
]);

const JARGON = [
  [/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/, "snake_case identifier"],
  [/\.(go|tsx?|dart|sql|mjs|jsx)\b/, "source file"],
  [/\/api\/|\bendpoint\b|\bhandler\b|\bbackend\b|\bfrontend\b/i, "internal path/term"],
  [/\b(trans_flag|flag\s*\d+|SELECT|INSERT|UPDATE\s+\w+\s+SET|PostgreSQL|Postgres|React|Next\.js|Golang|Flutter|DeepSeek|OpenAI|Gemini)\b/, "tech/vendor term"],
  [/`(?!https?:\/\/)[^`]*[A-Za-z_][^`]*`/, "code span"],
];

// Forbidden auth/token/password identifiers across ALL folders (both user and dev)
const FORBIDDEN_SECURITY = [
  [/\bbc_user_list\b/i, "forbidden auth table bc_user_list"],
  [/\bbc_mcp_access_tokens\b/i, "forbidden token table bc_mcp_access_tokens"],
  [/\bbc_mcp_token_databases\b/i, "forbidden token table bc_mcp_token_databases"],
  [/\bbc_mcp_token_audit\b/i, "forbidden token table bc_mcp_token_audit"],
  [/\bbc_google_account\b/i, "forbidden auth table bc_google_account"],
  [/\bpg_shadow\b/i, "forbidden system table pg_shadow"],
  [/\bpg_authid\b/i, "forbidden system table pg_authid"],
  [/\bpassword_hash\b/i, "forbidden credential field password_hash"],
  [/\bbcrypt\b/i, "forbidden hash keyword bcrypt"],
];

const VALID_AUDIENCE = new Set(["user", "dev", "both"]);
const VALID_RELATIONS = new Set([
  "uses_table",
  "writes_table",
  "posts_rule",
  "has_query",
  "exposes_api",
  "follows_rule",
  "part_of_arch",
  "solves_issue",
  "explains_term",
  "has_report",
  "guides_howto",
  "in_system",
  "answers_faq",
  "shares_menu",
  "implements_code",
  "bridges_zone",
  "hub_map",
  "related",
]);

const lineCount = new Map();
const lines = (f) => lineCount.get(f) ?? (lineCount.set(f, fs.readFileSync(f, "utf8").split("\n").length), lineCount.get(f));

const files = walk(VAULT);
const slugs = new Set(files.map((f) => path.basename(f, ".md").toLowerCase()));
const seenSlugs = new Map();
const errors = [];
const warn = [];
const driftedNotes = [];
const changedSourceCounts = new Map();

for (const file of files) {
  const rel = path.relative(VAULT, file).replace(/\\/g, "/");
  const folder = rel.includes("/") ? rel.split("/")[0] : "root";
  const base = path.basename(file, ".md");
  const slug = base.toLowerCase();

  if (base !== slug || !/^[a-z0-9-]+$/.test(slug)) {
    errors.push(`${rel}: slug "${base}" must be lowercase ascii kebab-case`);
  }
  if (seenSlugs.has(slug)) {
    errors.push(`${rel}: duplicate slug "${slug}" (already used by ${seenSlugs.get(slug)})`);
  } else {
    seenSlugs.set(slug, rel);
  }

  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  text.split("\n").forEach((ln, idx) => {
    for (const [re, why] of FORBIDDEN_SECURITY) {
      if (re.test(ln)) errors.push(`${rel}:${idx + 1}: FORBIDDEN_SECURITY (${why})`);
    }
  });

  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) {
    errors.push(`${rel}: no frontmatter`);
    continue;
  }
  let meta;
  try {
    meta = parse(fm[1]) ?? {};
  } catch (e) {
    errors.push(`${rel}: bad yaml ${e.message.split("\n")[0]}`);
    continue;
  }

  for (const k of ["title", "tags", "aliases", "sources"]) {
    if (meta[k] == null) errors.push(`${rel}: missing ${k}`);
  }
  if (meta.audience != null && !VALID_AUDIENCE.has(String(meta.audience).trim().toLowerCase())) {
    errors.push(`${rel}: invalid audience "${meta.audience}"`);
  }

  const body = text.slice(fm[0].length);
  if (/^##\s*ที่มาในโค้ด/m.test(body)) errors.push(`${rel}: has "ที่มาในโค้ด" section`);

  const isPolicy = rel.startsWith("playbook/") || rel === "dev-playbook/playbook-dev.md";
  if (USER_JARGON_FOLDERS.has(folder)) {
    const aliasList = Array.isArray(meta.aliases) ? meta.aliases.map(String) : [];
    const checkText = [...aliasList, ...body.split("\n")];
    checkText.forEach((ln, i) => {
      // Strip external media/reference URLs before snake_case/jargon scan so asset filenames (e.g. portal_pos.webp) or YouTube IDs do not false-positive as SQL identifiers
      const cleanedLn = ln.replace(/https?:\/\/[^\s)>\]"]+/g, "https://link").replace(/\[\[([a-z_]+)::/g, (m, r) => (VALID_RELATIONS.has(r) ? "[[" : m));
      for (const [re, why] of JARGON) {
        if (re.test(cleanedLn)) {
          const msg = `${rel}:${i < aliasList.length ? "alias" : i - aliasList.length + 1}: ${why}: ${ln.trim().slice(0, 90)}`;
          if (strictJargon) errors.push(msg);
          else warn.push(msg);
        }
      }
    });
  }

  const sources = Array.isArray(meta.sources) ? meta.sources : [];
  if (!isPolicy && !sources.length) errors.push(`${rel}: empty sources`);
  if (hasSrc || hasWebSrc) {
    const noteMtime = checkDrift ? fs.statSync(file).mtimeMs : 0;
    const staleSet = new Set();
    let maxLagHours = 0;
    for (const s of sources) {
      const m = String(s).match(/^(.+?)(?::(\d+)(?:-(\d+))?)?$/);
      if (!m || !m[1]) {
        errors.push(`${rel}: invalid source format "${s}"`);
        continue;
      }
      const isWebSource = m[1].startsWith("bcaiwebsite-live/");
      if (isWebSource && !hasWebSrc) continue;
      if (!isWebSource && !hasSrc) continue;
      const f = isWebSource ? path.join(WEB_SRC, m[1].slice("bcaiwebsite-live/".length)) : path.join(SRC, m[1]);
      if (!fs.existsSync(f)) {
        errors.push(`${rel}: source missing ${s}`);
        continue;
      }
      const st = fs.statSync(f);
      if (st.isDirectory()) continue;
      const tot = lines(f);
      const startLine = m[2] ? Number(m[2]) : null;
      const endLine = m[3] ? Number(m[3]) : null;
      if (startLine !== null && startLine < 1) errors.push(`${rel}: source line < 1 ${s}`);
      if (endLine !== null && startLine !== null && endLine < startLine) errors.push(`${rel}: source end < start ${s}`);
      if (startLine !== null && startLine > tot) errors.push(`${rel}: source line past EOF (${tot} lines) ${s}`);
      if (endLine !== null && endLine > tot) errors.push(`${rel}: source end line past EOF (${tot} lines) ${s}`);
      if (checkDrift && st.mtimeMs > noteMtime + 60_000) {
        if (!staleSet.has(m[1])) {
          staleSet.add(m[1]);
          changedSourceCounts.set(m[1], (changedSourceCounts.get(m[1]) ?? 0) + 1);
        }
        const lagHours = Math.round(((st.mtimeMs - noteMtime) / 3_600_000) * 10) / 10;
        if (lagHours > maxLagHours) maxLagHours = lagHours;
      }
    }
    if (checkDrift && staleSet.size > 0) {
      driftedNotes.push({ rel, staleSources: [...staleSet], maxLagHours });
    }
  }

  for (const [, edgeRel, t] of body.matchAll(/\[\[(?:([a-z_]+)::)?([^\]|#]+)/g)) {
    if (edgeRel && !VALID_RELATIONS.has(edgeRel)) errors.push(`${rel}: unknown relation "${edgeRel}" in [[${edgeRel}::${t}]]`);
    const target = path.basename(t.trim()).toLowerCase();
    if (!slugs.has(target)) errors.push(`${rel}: broken link [[${t}]]`);
  }
}

const byFolder = {};
for (const f of files) {
  const d = path.relative(VAULT, f).split(path.sep);
  const k = d.length > 1 ? d[0] : "root";
  byFolder[k] = (byFolder[k] ?? 0) + 1;
}
console.log(`notes ${files.length}`, byFolder, hasSrc ? "" : "(source check skipped)");
console.log(`errors ${errors.length}, warnings ${warn.length}`);
for (const e of errors.slice(0, 80)) console.log("ERR ", e);
for (const w of warn.slice(0, Number(process.env.WARN_LIMIT ?? 60))) console.log("WARN", w);
if (checkDrift && hasSrc) {
  driftedNotes.sort((a, b) => b.maxLagHours - a.maxLagHours);
  console.log(`drift: ${driftedNotes.length}/${files.length} notes have newer source edits`);
  for (const d of driftedNotes.slice(0, Number(process.env.DRIFT_LIMIT ?? 30))) {
    const extra = d.staleSources.length > 3 ? ` (+${d.staleSources.length - 3} more)` : "";
    console.log(`DRIFT ${d.rel} (+${d.maxLagHours}h) <- ${d.staleSources.slice(0, 3).join(", ")}${extra}`);
  }
  const topChanged = [...changedSourceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topChanged.length) {
    console.log("top changed sources:", topChanged.map(([p, c]) => `${p} (${c})`).join(", "));
  }
}
process.exit(errors.length || (failOnDrift && driftedNotes.length > 0) ? 1 : 0);
