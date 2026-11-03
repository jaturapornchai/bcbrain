// Fails (exit 1) when any vault note looks like it contains a secret. Runs before every build.
// A line can opt out with the marker  secret-scan:allow  (use only after checking it is not a secret).
import fs from "node:fs";
import path from "node:path";

const VAULT = path.resolve(process.argv[2] ?? "vault"); // optional dir arg for the self-test
const RULES = [
  ["OpenAI/Anthropic key", /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}/],
  ["AWS access key", /\bA(?:KIA|SIA)[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["URI with password", /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@`'"]+:[^\s/@`'"<>{}$]+@/i],
  ["Bearer token", /\bBearer\s+(?!<)[A-Za-z0-9._~+/-]{20,}/],
  ["assigned secret", /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?(?![<{$*])[^\s"'`<>,;)]{8,}/i],
  ["email", /\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|co|th|io|ai|dev|app|me|info|biz)\b/i],
];
// ponytail: BC menu codes look like 7.10.1.1; all-small octets (<=31) are treated as codes, not hosts. Tighten if a real host in that range ever matters. // pragma: allowlist secret
const MENU_CODE = /^(?:[12]?\d|3[01])(?:\.(?:[12]?\d|3[01])){3}$/;
const PRIVATE_IP = /^(?:127\.|10\.|0\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|255\.)/;
const IPV4 = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;

const files = (function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith(".") ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".md") ? [path.join(d, e.name)] : [],
  );
})(VAULT);

const hits = [];
for (const f of files) {
  fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (line.includes("secret-scan:allow")) return;
    const where = `${path.relative(process.cwd(), f)}:${i + 1}`;
    for (const [name, re] of RULES) if (re.test(line)) hits.push(`${where}  ${name}`);
    for (const ip of line.match(IPV4) ?? []) if (!PRIVATE_IP.test(ip) && !MENU_CODE.test(ip)) hits.push(`${where}  public IPv4`);
  });
}

if (hits.length) {
  // print location + rule only, never the matched value
  console.error(`secret-scan: ${hits.length} suspicious line(s) — fix the note before building:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`secret-scan: ${files.length} notes clean`);
