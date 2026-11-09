// Lint the customer-facing vault: frontmatter, no developer jargon in body/aliases, real `sources`, no broken [[links]].
// Usage: node scripts/check-notes.mjs [path-to-bcaiaccount]   (source check is skipped when the repo is not on this machine)
import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const VAULT = path.join(process.cwd(), "vault");
const SRC = process.argv[2] ?? "D:/bcaiaccount";
const hasSrc = fs.existsSync(SRC);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".md") ? [path.join(d, e.name)] : []));

// ponytail: regex heuristics, not a parser; a hit is "look at this line", false positives get reworded
const JARGON = [
  [/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/, "snake_case identifier"],
  [/\.(go|tsx?|dart|sql|mjs|jsx)\b/, "source file"],
  [/\/api\/|\bendpoint\b|\bhandler\b|\bbackend\b|\bfrontend\b/i, "internal path/term"],
  [/\b(trans_flag|flag\s*\d+|SELECT|INSERT|UPDATE\s+\w+\s+SET|PostgreSQL|Postgres|React|Next\.js|Golang|Flutter|DeepSeek|OpenAI|Gemini)\b/, "tech/vendor term"],
  [/`(?!https?:\/\/)[^`]*[A-Za-z_][^`]*`/, "code span"],
];

const lineCount = new Map();
const lines = (f) => lineCount.get(f) ?? (lineCount.set(f, fs.readFileSync(f, "utf8").split("\n").length), lineCount.get(f));

const files = walk(VAULT);
const slugs = new Set(files.map((f) => path.basename(f, ".md").toLowerCase()));
const errors = [];
const warn = [];
for (const file of files) {
  const rel = path.relative(VAULT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) { errors.push(`${rel}: no frontmatter`); continue; }
  let meta;
  try { meta = parse(fm[1]) ?? {}; } catch (e) { errors.push(`${rel}: bad yaml ${e.message.split("\n")[0]}`); continue; }
  for (const k of ["title", "tags", "aliases", "sources"]) if (meta[k] == null) errors.push(`${rel}: missing ${k}`);
  const body = text.slice(fm[0].length);
  if (/^##\s*ที่มาในโค้ด/m.test(body)) errors.push(`${rel}: has "ที่มาในโค้ด" section`);
  const isPolicy = rel.startsWith("playbook/"); // ponytail: playbooks talk to the AI, tool names are allowed there
  const checkText = isPolicy ? [] : [...(meta.aliases ?? []).map(String), ...body.split("\n")];
  checkText.forEach((ln, i) => {
    for (const [re, why] of JARGON) if (re.test(ln)) warn.push(`${rel}:${i < (meta.aliases?.length ?? 0) ? "alias" : i - (meta.aliases?.length ?? 0) + 1}: ${why}: ${ln.trim().slice(0, 90)}`);
  });
  if (!isPolicy && !(meta.sources ?? []).length) errors.push(`${rel}: empty sources`);
  if (hasSrc) for (const s of meta.sources ?? []) {
    const m = String(s).match(/^(.+?)(?::(\d+)(?:-\d+)?)?$/);
    const f = path.join(SRC, m[1]);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { if (!fs.existsSync(f)) errors.push(`${rel}: source missing ${s}`); continue; }
    if (m[2] && Number(m[2]) > lines(f)) errors.push(`${rel}: source line past EOF ${s}`);
  }
  for (const [, t] of body.matchAll(/\[\[([^\]|#]+)/g)) if (!slugs.has(path.basename(t.trim()).toLowerCase())) warn.push(`${rel}: broken link [[${t}]]`);
}
const byFolder = {};
for (const f of files) { const d = path.relative(VAULT, f).split(path.sep); byFolder[d.length > 1 ? d[0] : "root"] = (byFolder[d.length > 1 ? d[0] : "root"] ?? 0) + 1; }
console.log(`notes ${files.length}`, byFolder, hasSrc ? "" : "(source check skipped)");
console.log(`errors ${errors.length}, warnings ${warn.length}`);
for (const e of errors.slice(0, 60)) console.log("ERR ", e);
for (const w of warn.slice(0, Number(process.env.WARN_LIMIT ?? 60))) console.log("WARN", w);
process.exit(errors.length ? 1 : 0);
