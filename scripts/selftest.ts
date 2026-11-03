// node scripts/selftest.ts  — smallest checks for search, rendering safety and the secret scanner
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { excerpt, getNote, graph, renderNote, search, terms, vault } from "../lib/vault.ts";

assert.deepEqual(terms("ตัดสต็อกยังไง"), ["ตัด", "สต็อก"]); // fragment glue + stopword
assert.ok(terms("query gateway คือ อะไร").includes("gateway"));
assert.ok(vault().has("index"), "vault/index.md loads");
assert.equal(search("สารบัญ เริ่มที่นี่")[0]?.slug, "index");
assert.ok(terms("bc_mcp_tokens").includes("mcp"), "identifier parts are searchable");
for (const s of ["INDEX", "[[index]]", "[[index|สารบัญ]]", "index.md", "vault/index.md"]) assert.equal(getNote(s)?.slug, "index", s);
const ex = excerpt("intro\n## A\n" + "x".repeat(50) + "\n## B gold\ngold", ["gold"], 30);
assert.ok(ex.includes("## B gold") && !ex.includes("xxx") && ex.includes("omitted sections: A"), ex);
const { links } = graph();
assert.equal(new Set(links.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`))).size, links.length, "A→B and B→A are one synapse");

const evil = { ...vault().get("index")!, body: '<img src=x onerror=alert(1)> [x](javascript:alert(1)) [[nope-missing]]' };
const html = renderNote(evil);
assert.ok(!html.includes("<img"), "raw HTML is escaped");
assert.ok(!html.includes("javascript:"), "javascript: links neutralised");
assert.ok(html.includes('href="#missing"'), "unresolved wikilink marked");
const pragma = renderNote({ ...evil, body: "menu `1.11.1.6` <!-- pragma: allowlist secret -->\n\n| a | b |\n|---|---|\n| 1 | 7.10.1.1 | <!-- pragma: allowlist secret -->\n\n<!-- x --><script>alert(1)</script>" }); // pragma: allowlist secret
assert.ok(!pragma.includes("pragma") && !pragma.includes("<script"), "HTML comments dropped, other raw HTML still escaped");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
fs.writeFileSync(path.join(dir, "a.md"), `token ${"gh" + "p_" + "a".repeat(36)}\nhost ${[93, 184, 216, 34].join(".")}\nmenu 7.10.1.1\n`); // pragma: allowlist secret
let failed = false;
try {
  execFileSync(process.execPath, ["scripts/scan-secrets.mjs", dir], { stdio: "pipe" });
} catch (e) {
  failed = true;
  const out = String((e as { stderr: Buffer }).stderr);
  assert.ok(out.includes("GitHub token") && out.includes("public IPv4"), out);
  assert.ok(out.includes("2 suspicious"), "menu code 7.10.1.1 is not an IP: " + out); // pragma: allowlist secret
  assert.ok(!out.includes("a".repeat(36)), "scanner never prints the secret");
}
assert.ok(failed, "scanner must fail on secrets");
fs.rmSync(dir, { recursive: true });
console.log("selftest ok");
