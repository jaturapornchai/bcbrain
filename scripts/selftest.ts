// node scripts/selftest.ts — checks for groups, audience isolation, BM25 search, rendering safety, secret scanner, and canonical vault hubs
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Allow Node 24 native TS execution to resolve extensionless relative imports used by Next.js / tsconfig
registerHooks({
  resolve(specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: { parentURL?: string }) => unknown) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith("file:")) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context) as { url: string; shortCircuit?: boolean };
  },
});

const { GROUPS, RELATION_TYPES, groupOf, inferRelation, matchesAudience } = await import("../lib/groups.ts");
const { clearGaps, getGapReport } = await import("../lib/gap-log.ts");
const { getGroundingStats, verifyReferences } = await import("../lib/grounding-runtime.ts");
const { getOpenApiSpec } = await import("../lib/openapi.ts");
const { collectRelatedMedia, connectedNeighbors, excerpt, excerptNote, expandSynonyms, extractNoteMedia, findMedia, getBootstrapPack, getNote, getNoteTldr, getVaultPackGzip, graph, lookupDirect, parseYouTubeUrl, renderNote, resolveBcImageUrl, search, searchWithMeta, stripSeeAlso, terms, traverseGraph, vault } = await import("../lib/vault.ts");
const {
  dispatchJsonRpcRaw,
  getManifest,
  runErrorRestQuery,
  runFactsRestQuery,
  runFastRestQuery,
  runGapsRestQuery,
  runSectionsRestQuery,
  runVerifyRestQuery,
  runWhatsNewRestQuery,
  SERVER_INFO,
} = await import("../lib/mcp-engine.ts");
type NoteType = import("../lib/vault.ts").Note;

// 1. Groups & Audience contract
const expectedUser = ["playbook", "start", "howto", "troubleshoot", "faq", "reports", "systems", "glossary", "sales"];
const expectedDev = ["dev-playbook", "schema", "queries", "api", "doctypes", "architecture"];
assert.equal(Object.keys(GROUPS).length, 16, "GROUPS has all 16 keys");
assert.equal(GROUPS.root.audience, "both");
for (const k of expectedUser) assert.equal(GROUPS[k]?.audience, "user", `${k} is user`);
for (const k of expectedDev) assert.equal(GROUPS[k]?.audience, "dev", `${k} is dev`);
assert.equal(new Set(Object.values(GROUPS).map((g) => g.color)).size, 16, "all 16 group colors are distinct");
assert.equal(groupOf("schema").audience, "dev");
assert.equal(matchesAudience("user", "user"), true);
assert.equal(matchesAudience("dev", "user"), false);
assert.equal(matchesAudience("both", "user"), true);
assert.equal(matchesAudience("dev", "dev"), true);
assert.equal(matchesAudience("user", "dev"), false);
assert.equal(matchesAudience("both", "dev"), true);
assert.equal(matchesAudience("user", "all"), true);
assert.equal(matchesAudience("dev", "all"), true);

// 2. Thai segmentation + spelling variant normalization + SQL identifier splitting + excerpt
assert.deepEqual(terms("ตัดสต็อกยังไง"), ["ตัด", "สต็อก"]); // fragment glue + stopword
assert.deepEqual(terms("ตัดสต๊อกยังไง"), ["ตัด", "สต็อก"]); // variant สต๊อก → สต็อก
assert.ok(terms("query gateway คือ อะไร").includes("gateway"));
assert.ok(terms("bc_mcp_tokens").includes("mcp"), "identifier parts are searchable");
assert.ok(terms("ic_trans_detail").includes("ic_trans_detail"), "full identifier kept");

const ex = excerpt("intro\n## A\n" + "x".repeat(50) + "\n## B gold\ngold", ["gold"], 30);
assert.ok(ex.includes("## B gold") && !ex.includes("xxx") && ex.includes("omitted sections: A"), ex);
const exFence = excerpt("intro\n```sql\nSELECT " + "a, ".repeat(40) + "b FROM ic_trans;\n```", ["sql"], 60);
assert.equal((exFence.match(/^```/gm) ?? []).length % 2, 0, "excerpt closes unclosed code fence cleanly");

// 3. XSS / wikilink render safety
const synthetic: NoteType = {
  slug: "synthetic-test",
  folder: "root",
  audience: "both",
  title: "Test",
  tags: [],
  aliases: [],
  sources: [],
  body: '<img src=x onerror=alert(1)> [x](javascript:alert(1)) [[nope-missing]]',
  links: [],
  backlinks: [],
  outEdges: [],
  inEdges: [],
  haystack: { title: "test", meta: "synthetic-test", body: "" },
};
const html = renderNote(synthetic);
assert.ok(!html.includes("<img"), "raw HTML is escaped");
assert.ok(!html.includes("javascript:"), "javascript: links neutralised");
assert.ok(html.includes('href="#missing"'), "unresolved wikilink marked");
const typedHtml = renderNote({
  ...synthetic,
  body: "ดู [[uses_table::index|สารบัญสมอง]] และ [[bad_rel::index]]",
});
assert.ok(typedHtml.includes('href="/n/index"') && !typedHtml.includes("uses_table::"), "typed wikilink renders cleanly");
const pragma = renderNote({
  ...synthetic,
  body: "menu `1.11.1.6` <!-- pragma: allowlist secret -->\n\n| a | b |\n|---|---|\n| 1 | 7.10.1.1 | <!-- pragma: allowlist secret -->\n\n<!-- x --><script>alert(1)</script>", // pragma: allowlist secret
});
assert.ok(!pragma.includes("pragma") && !pragma.includes("<script"), "HTML comments dropped, other raw HTML still escaped");

// Media connectors: www.bcaccount.com image normalization + whitelist & YouTube embed card
assert.equal(
  resolveBcImageUrl("https://www.bcaccount.com/manual/images/04-main-menu-dashboard.png"),
  "https://bcaccount.com/manual/images/04-main-menu-dashboard.png",
  "www.bcaccount.com normalizes to apex bcaccount.com for 200 OK image delivery",
);
assert.equal(resolveBcImageUrl("https://evil.example.com/track.png"), null, "untrusted external image host blocked");
const ytParsed = parseYouTubeUrl("https://www.youtube.com/watch?v=_DattZyKqDA&list=PLO9P7tPZLXB0");
assert.equal(ytParsed?.videoId, "_DattZyKqDA");
assert.equal(ytParsed?.listId, "PLO9P7tPZLXB0");
const mediaHtml = renderNote({
  ...synthetic,
  body: "![หน้าจอหลัก](https://www.bcaccount.com/manual/images/04-main-menu-dashboard.png)\n\n![บล็อก](https://evil.example.com/x.png)\n\n[🎬 แนะนำสมองของกิจการ](https://www.youtube.com/watch?v=_DattZyKqDA&list=PLO9P7tPZLXB0)\n",
});
assert.ok(mediaHtml.includes('class="md-fig"') && mediaHtml.includes('src="https://bcaccount.com/manual/images/04-main-menu-dashboard.png"'), "bcaccount image renders figure");
assert.ok(!mediaHtml.includes("evil.example.com"), "untrusted image never rendered");
assert.ok(mediaHtml.includes('class="yt-card"') && mediaHtml.includes("https://www.youtube-nocookie.com/embed/_DattZyKqDA?list=PLO9P7tPZLXB0&amp;rel=0"), "YouTube link renders privacy-enhanced embed card");

// 4. Secret scanner (including bcrypt & argon2)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-"));
const fakeBcrypt = "$2b$10$" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4Y5z6a";
const fakeArgon2 = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZQ$hashvaluehere123456";
fs.writeFileSync(
  path.join(dir, "a.md"),
  `token ${"gh" + "p_" + "a".repeat(36)}\nhost ${[93, 184, 216, 34].join(".")}\nmenu 7.10.1.1\nhash1 ${fakeBcrypt}\nhash2 ${fakeArgon2}\n`, // pragma: allowlist secret
);
let failed = false;
try {
  execFileSync(process.execPath, ["scripts/scan-secrets.mjs", dir], { stdio: "pipe" });
} catch (e) {
  failed = true;
  const out = String((e as { stderr: Buffer }).stderr);
  assert.ok(out.includes("GitHub token") && out.includes("public IPv4"), out);
  assert.ok(out.includes("bcrypt hash") && out.includes("argon2 hash"), out);
  assert.ok(out.includes("4 suspicious"), "menu code 7.10.1.1 is not an IP: " + out); // pragma: allowlist secret
  assert.ok(!out.includes("a".repeat(36)) && !out.includes(fakeBcrypt), "scanner never prints secrets");
}
assert.ok(failed, "scanner must fail on secrets");
fs.rmSync(dir, { recursive: true });

// 5. Vault isolation & BM25 unit test in isolated temp workspace (runs even while real vault is rebuilding)
const mockRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bcbrain-mock-"));
try {
  fs.mkdirSync(path.join(mockRoot, "vault", "empty-temp"), { recursive: true });
  fs.mkdirSync(path.join(mockRoot, "vault", "howto"), { recursive: true });
  fs.mkdirSync(path.join(mockRoot, "vault", "schema"), { recursive: true });
  fs.mkdirSync(path.join(mockRoot, "vault", "queries"), { recursive: true });
  fs.writeFileSync(
    path.join(mockRoot, "vault", "index.md"),
    "---\ntitle: แผนที่สมองหลัก\ntags: [root]\naliases: [สารบัญ]\nsources: []\n---\n[[user-doc]] [[dev-short]]\n",
  );
  fs.writeFileSync(
    path.join(mockRoot, "vault", "howto", "user-doc.md"),
    "---\ntitle: วิธีขายสินค้าและออกบิล\ntags: [howto]\naliases: [ออกบิลขาย]\nsources: [a.go:1]\n---\nคู่มือขายสินค้าและเช็คเด้ง เชื่อม [[index]] และ [[dev-short]]\n",
  );
  fs.writeFileSync(
    path.join(mockRoot, "vault", "schema", "dev-short.md"),
    "---\ntitle: สรุปย่อ ic_trans\ntags: [schema]\naliases: [ic_trans]\nsources: [a.sql:1]\n---\nตารางหัวเอกสารสต็อก ic_trans สั้นกระชับ [[index]] [[user-doc]]\n",
  );
  fs.writeFileSync(
    path.join(mockRoot, "vault", "queries", "dev-long-sql.md"),
    `---\ntitle: คลังคำสั่งรายงานใหญ่\ntags: [queries]\naliases: [รายงานยาว]\nsources: [a.sql:2]\n---\n${"รายงานสต็อกเคลื่อนไหวแสดงผลลัพธ์ละเอียด ".repeat(120)} จุดสำคัญคือ tokenพิเศษ ที่โผล่แค่ครั้งเดียวเทียบกับข้อความยาวมาก\n`,
  );
  fs.writeFileSync(
    path.join(mockRoot, "vault", "queries", "dev-short-hit.md"),
    "---\ntitle: คู่มือสั้นเฉพาะทาง\ntags: [queries]\naliases: [สั้นเฉพาะทาง]\nsources: [a.sql:3]\n---\nคำอธิบายสั้นเกี่ยวกับ tokenพิเศษ และการใช้งานตรงจุด\n",
  );

  const probe = `
    import assert from "node:assert/strict";
    import fs from "node:fs";
    import { registerHooks } from "node:module";
    import { fileURLToPath, pathToFileURL } from "node:url";
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier.startsWith(".") && !specifier.endsWith(".ts") && context.parentURL?.startsWith("file:")) {
          const candidate = new URL(specifier + ".ts", context.parentURL);
          if (fs.existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
    const { graph, search, vault } = await import(pathToFileURL(${JSON.stringify(path.resolve("lib/vault.ts"))}).href);
    assert.equal(vault().size, 5, "empty folder ignored safely");
    const gu = graph("user");
    assert.ok(gu.nodes.every((n) => n.audience !== "dev"), "graph(user) excludes dev");
    assert.equal(gu.nodes.length, 2);
    assert.equal(gu.links.length, 1, "graph(user) keeps only user-both links");
    const gd = graph("dev");
    assert.ok(gd.nodes.every((n) => n.audience !== "user"), "graph(dev) excludes user");
    assert.equal(gd.nodes.length, 4);
    assert.equal(gd.links.length, 1, "graph(dev) keeps only dev-both links");
    assert.ok(search("ic_trans", 10, "user").every((h) => h.audience !== "dev"), "search(user) zero dev");
    assert.ok(search("ขายสินค้า", 10, "dev").every((h) => h.audience !== "user"), "search(dev) zero user");
    const bm25 = search("tokenพิเศษ", 5, "dev");
    assert.equal(bm25[0]?.slug, "dev-short-hit", "BM25 length norm prefers focused short note over bloated note");
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", probe], { cwd: mockRoot, stdio: "pipe" });
} finally {
  fs.rmSync(mockRoot, { recursive: true, force: true });
}

if (process.env.SELFTEST_UNIT_ONLY === "1") {
  console.log("selftest unit ok (vault checks skipped via SELFTEST_UNIT_ONLY=1)");
  process.exit(0);
}

// 6. Real vault checks against canonical hub slugs from docs/extract-brief.md
assert.ok(vault().has("index"), "vault/index.md loads");
for (const slug of [
  "index",
  "playbook-call-center",
  "playbook-sales",
  "menu-catalog-overview",
  "video-visual-tutorials",
  "website-manual-and-blog-directory",
  "start-first-day",
  "howto-screen-shortcuts-workbench",
  "howto-admin-system-management",
  "howto-tax-calendar-and-sme-incentives",
  "howto-sale-overview",
  "howto-tax-overview",
  "howto-doc-edit-cancel-delete",
  "ts-overview",
  "ts-menu-missing-switchboard",
  "ts-common-no-permission",
  "ts-common-period-closed",
  "sales-overview",
  "sales-pricing-packages",
  "sales-accounting-partner",
  "sales-support-implementation-contact",
  "sys-bc-ai-chat-oa",
  "playbook-dev",
  "dev-rules-accounting-sql",
  "dev-integration-quickstart",
  "schema-overview",
  "sql-overview",
  "api-overview",
  "api-mcp-gateway",
  "doctypes-overview",
  "arch-overview",
]) {
  assert.ok(vault().has(slug), `canonical hub exists: ${slug}`);
}

for (const s of ["INDEX", "[[index]]", "[[index|สารบัญ]]", "index.md", "vault/index.md"]) {
  assert.equal(getNote(s)?.slug, "index", s);
}

const gAll = graph("all");
const gUser = graph("user");
const gDev = graph("dev");
assert.equal(new Set(gAll.links.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`))).size, gAll.links.length, "A→B and B→A are one synapse");
assert.ok(gUser.nodes.every((n) => n.audience !== "dev"), "graph(user) returns zero dev nodes");
assert.ok(gDev.nodes.every((n) => n.audience !== "user"), "graph(dev) returns zero user-only nodes");
assert.ok(gUser.links.every(([a, b]) => a < gUser.nodes.length && b < gUser.nodes.length), "graph(user) links in bounds");
assert.ok(gDev.links.every(([a, b]) => a < gDev.nodes.length && b < gDev.nodes.length), "graph(dev) links in bounds");

// Audience isolation across realistic cross-zone queries
for (const q of ["ic_trans", "gl_journal SELECT", "trans_flag", "MCP Gateway"]) {
  const hits = search(q, 20, "user");
  assert.ok(hits.every((h) => h.audience !== "dev"), `user search("${q}") must return zero dev notes`);
}
for (const q of ["ราคาเท่าไร", "เช็คเด้ง", "เปิดบิลขาย", "ออกใบกำกับภาษี"]) {
  const hits = search(q, 20, "dev");
  assert.ok(hits.every((h) => h.audience !== "user"), `dev search("${q}") must return zero user-only notes`);
}

// Realistic retrieval checks using canonical hub slugs
assert.equal(search("สารบัญ แผนที่สมอง", 5, "all")[0]?.slug, "index");
for (const [q, ...acceptable] of [
  ["เริ่มต้นใช้งานวันแรก ตั้งค่าบริษัท", "start-first-day"],
  ["ขายสินค้า ออกบิลขาย", "howto-sale-overview"],
  ["แก้ไข ยกเลิก ลบ เอกสาร", "howto-doc-edit-cancel-delete"],
  ["เข้าเมนูไม่ได้ ไม่มีสิทธิ์", "ts-common-no-permission", "ts-overview"],
  ["ปิดงวดบัญชีแล้ว แก้เอกสารไม่ได้", "ts-common-period-closed", "ts-overview"],
  ["ข้อมูลการขาย ระบบในชุด BC", "sales-overview", "sys-overview"],
]) {
  const hits = search(q, 5, "user");
  assert.ok(hits.some((h) => acceptable.includes(h.slug)), `user search "${q}" → expected one of [${acceptable}], got [${hits.map((h) => h.slug)}]`);
}

for (const [q, ...acceptable] of [
  ["กฎเหล็ก SQL บัญชี NUMERIC last_status", "dev-rules-accounting-sql"],
  ["เริ่มต้นเชื่อมต่อระบบ API quickstart", "dev-integration-quickstart"],
  ["โครงสร้างตาราง Data Dictionary schema", "schema-overview"],
  ["คลังคำสั่ง SQL SELECT", "sql-overview"],
  ["MCP Gateway API", "api-mcp-gateway", "api-overview"],
  ["trans_flag ผังบัญชี Dr Cr", "doctypes-overview"],
  ["สถาปัตยกรรม Multi-Tenant Feature Switchboard", "arch-overview"],
]) {
  const hits = search(q, 5, "dev");
  assert.ok(hits.some((h) => acceptable.includes(h.slug)), `dev search "${q}" → expected one of [${acceptable}], got [${hits.map((h) => h.slug)}]`);
}

// 7. /bcbrain skill parity, frontmatter contract, and secret-scan cleanliness
const agentSkillPath = path.resolve(".agents/skills/bcbrain/SKILL.md");
const publicSkillPath = path.resolve("public/skills/bcbrain/SKILL.md");
assert.ok(fs.existsSync(agentSkillPath), ".agents/skills/bcbrain/SKILL.md exists");
assert.ok(fs.existsSync(publicSkillPath), "public/skills/bcbrain/SKILL.md exists");
const agentSkillRaw = fs.readFileSync(agentSkillPath, "utf8");
const publicSkillRaw = fs.readFileSync(publicSkillPath, "utf8");
assert.equal(agentSkillRaw, publicSkillRaw, "public SKILL.md matches .agents/skills/bcbrain/SKILL.md byte-for-byte");
assert.match(agentSkillRaw, /^---\r?\n[\s\S]*?\bname:\s*bcbrain\b[\s\S]*?\r?\n---/, "SKILL.md frontmatter declares name: bcbrain");
assert.ok(agentSkillRaw.includes("/bcbrain"), "SKILL.md documents /bcbrain slash usage");
assert.ok(agentSkillRaw.includes("https://brain.bcsmethai.com/mcp"), "SKILL.md references BC Brain MCP endpoint");
for (const skillDir of [".agents/skills/bcbrain", "public/skills/bcbrain"]) {
  execFileSync(process.execPath, ["scripts/scan-secrets.mjs", skillDir], { stdio: "pipe" });
}

// 8. Lean GraphRAG: typed edges, implicit SQL table synapses, Thai-SQL synonyms, multi-hop traverse & audience isolation
assert.equal(inferRelation("queries", "schema"), "uses_table");
assert.equal(inferRelation("doctypes", "schema"), "writes_table");
assert.ok(RELATION_TYPES.includes("uses_table") && gAll.rels.length === gAll.links.length, "graph().rels aligns 1:1 with links");

const sqlBal = getNote("sql-ic-stock-balance");
assert.ok(sqlBal, "sql-ic-stock-balance exists");
assert.ok(
  sqlBal!.outEdges.some((e) => e.slug === "tbl-ic-inventory" && e.rel === "uses_table"),
  "implicit SQL synapse links sql-ic-stock-balance -> tbl-ic-inventory",
);
assert.ok(
  sqlBal!.outEdges.some((e) => e.slug === "tbl-ic-trans-detail" && e.rel === "uses_table"),
  "implicit SQL synapse links sql-ic-stock-balance -> tbl-ic-trans-detail",
);
assert.ok(
  [...vault().values()]
    .filter((n) => n.audience !== "dev")
    .every((n) =>
      n.outEdges.every(
        (e) =>
          !e.inferred ||
          (e.rel === "shares_menu" && vault().get(e.slug)?.audience === "user"),
      ),
    ),
  "implicit SQL/code synapses only apply to dev notes; inferred shares_menu stays strictly inside user zone",
);
assert.ok(
  traverseGraph({ slug: "start-mcp-ai", depth: 2, audience: "user" }).neighbors.every((s) => s.audience !== "dev"),
  "traverseGraph(user) filters out cross-zone dev links like api-mcp-gateway",
);

assert.ok(expandSynonyms(["ซัพพลายเออร์"]).includes("เจ้าหนี้"), "synonym expands ซัพพลายเออร์ -> เจ้าหนี้");
const synDevHits = search("ซัพพลายเออร์ ค้างจ่าย", 5, "dev");
assert.ok(synDevHits.length > 0 && synDevHits.every((h) => h.audience !== "user"), "dev synonym search isolates user notes");
const synUserHits = search("ภพ30 ภาษีซื้อขาย", 5, "user");
assert.ok(synUserHits.length > 0 && synUserHits.every((h) => h.audience !== "dev"), "user synonym search isolates dev notes");

const travMulti = traverseGraph({ slug: "sql-ic-stock-balance", depth: 2, audience: "dev", limit: 30 });
assert.ok(travMulti.neighbors.some((s) => s.hop === 1) && travMulti.neighbors.some((s) => s.hop === 2), "traverseGraph returns hop 1 and hop 2");
assert.ok(travMulti.neighbors.every((s) => s.audience !== "user"), "traverseGraph(dev) never leaks user notes");
assert.ok(!travMulti.neighbors.some((s) => s.via === "index"), "traverseGraph does not explode hop 2 via index hub");

const travPath = traverseGraph({ slug: "sql-ic-stock-balance", toSlug: "tbl-ic-unit", audience: "dev" });
assert.ok(travPath.mode === "path" && (travPath.path?.length ?? 0) >= 1 && travPath.path?.at(-1)?.slug === "tbl-ic-unit", "shortest path reaches tbl-ic-unit");

const travIso = traverseGraph({ slug: "sql-ic-stock-balance", depth: 2, audience: "user" });
assert.equal(travIso.start, null, "traverseGraph(user) blocks dev start slug");
assert.equal(travIso.neighbors.length, 0, "traverseGraph(user) returns zero neighbors for dev slug");

const nbCtx = connectedNeighbors(["sql-ic-stock-balance"], "dev", 6);
assert.ok(nbCtx.length > 0 && nbCtx.every((s) => s.audience !== "user" && s.slug !== "index"), "connectedNeighbors respects dev isolation");

// 9. MCP Media extraction, 1-hop related media fallback, and findMedia()
const parsedMedia = extractNoteMedia(
  "![ภาพหน้าขาย](https://www.bcaccount.com/manual/images/23-sales-invoice.png)\n[🎬 สอนขายสินค้า](https://www.youtube.com/watch?v=4b7hW0pxf9Y&list=PLO9P7tPZLXB0)\n[คู่มือขาย](https://www.bcaccount.com/manual/sales)",
  "ทดสอบสื่อ",
);
assert.equal(parsedMedia.images[0]?.url, "https://bcaccount.com/manual/images/23-sales-invoice.png");
assert.equal(parsedMedia.videos[0]?.videoId, "4b7hW0pxf9Y");
assert.equal(parsedMedia.videos[0]?.thumbnailUrl, "https://i.ytimg.com/vi/4b7hW0pxf9Y/hqdefault.jpg");
assert.equal(parsedMedia.webPages[0]?.url, "https://bcaccount.com/manual/sales");

// Sub-note without direct media (howto-sale-quotation) pulls Sales screenshot & EP.4 YouTube tutorial via 1-hop neighbor (howto-sale-overview)
const hopMedia = collectRelatedMedia(["howto-sale-quotation"], "user");
assert.ok(hopMedia.images.some((i) => i.url.startsWith("https://bcaccount.com/")), "1-hop media fallback surfaces bcaccount.com screenshot");
assert.ok(hopMedia.videos.some((v) => v.url.includes("youtube.com/watch")), "1-hop media fallback surfaces YouTube tutorial");

const poMedia = findMedia({ query: "ใบสั่งซื้อ", kind: "all", audience: "user", limit: 15 });
assert.ok(poMedia.items.some((x) => x.kind === "youtube" && x.videoId === "74csOGLdjJk"), "findMedia('ใบสั่งซื้อ') returns EP.3 Purchase YouTube");
assert.ok(poMedia.items.some((x) => x.kind === "image" && x.url.startsWith("https://bcaccount.com/")), "findMedia('ใบสั่งซื้อ') returns screenshot");

const vidHits = search("วิดีโอสอนใช้งาน YouTube", 5, "user");
assert.ok((vidHits[0]?.videos?.length ?? 0) > 0 && (vidHits[0]?.images?.length ?? 0) > 0, "search() attaches images & videos arrays to SearchHit");

// 10. Deep D:\bcaiaccount coverage + Smart Neural Synapses (bridges_zone, implements_code, shares_menu)
assert.ok(vault().size >= 365, "vault has >= 365 comprehensive notes");
assert.ok(gAll.links.length >= 2000, "3D brain has >= 2000 neural synapses");
const crossPath = traverseGraph({ slug: "howto-marketplace-shopee-lazada-tiktok", toSlug: "tbl-ar-contract-marketplace", audience: "all" });
assert.ok(
  crossPath.mode === "path" &&
    (crossPath.path?.length ?? 0) >= 1 &&
    crossPath.path!.length <= 3 &&
    crossPath.path!.some((s) => s.rel === "bridges_zone"),
  "bridges_zone connects User screen directly to Dev schema table in <= 3 hops without index hub",
);
const menuPeers = traverseGraph({ slug: "howto-stock-costing-recalc", depth: 1, relation: "shares_menu", audience: "user" });
assert.ok(menuPeers.neighbors.some((s) => s.slug === "ts-stock-cost-mismatch-rebuild"), "shares_menu links Menu 2050 howto <-> troubleshoot");
const codePeers = traverseGraph({ slug: "doc-marketplace-payroll-dbd-evrt", depth: 1, relation: "implements_code", audience: "dev" });
assert.ok(codePeers.neighbors.length > 0 && codePeers.neighbors.every((s) => s.audience === "dev"), "implements_code links dev notes sharing Go handlers");

// 11. Anti-hallucination confidence scoring (high on grounded queries, low on ungrounded/out-of-domain queries)
const highMeta = searchWithMeta("โครงสร้างตาราง ic_trans_detail", 4, "dev");
assert.equal(highMeta.confidence, "high", `grounded dev query should be high confidence, got ${JSON.stringify(highMeta)}`);
for (const trap of ["ยานอวกาศ ดาวอังคาร บั้งไฟพญานาค คอนโดหรู", "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", "วิธีปลูกทุเรียนภูเขาไฟ"]) {
  const lowMeta = searchWithMeta(trap, 4, "user");
  const cov = lowMeta.bestMatchedTerms / Math.max(1, lowMeta.totalTerms);
  assert.equal(lowMeta.confidence, "low", `out-of-domain query "${trap}" must flag low confidence, got ${JSON.stringify(lowMeta)}`);
  assert.ok(cov < 0.5 || lowMeta.topScore < 18, `out-of-domain query "${trap}" must trigger abstain threshold`);
}

const lang1005 = searchWithMeta("1005 ปรับปรุงภาษา Language Dictionary", 5, "user");
assert.ok(
  lang1005.hits.some((h) => h.slug === "menu-catalog-overview" || h.slug === "menu-cat-1-setup" || h.slug === "howto-global-ui-bilingual-datalist-tools"),
  `1005 search should retrieve menu/language docs, got ${JSON.stringify(lang1005.hits.map((h) => h.slug))}`,
);
const fmt1015 = searchWithMeta("1015 กำหนดรูปแบบเลขที่เอกสาร", 3, "user");
assert.ok(
  fmt1015.hits.some((h) => h.slug === "start-doc-formats" || h.slug === "menu-cat-1-setup"),
  `1015 search should retrieve start-doc-formats or menu-cat-1-setup, got ${JSON.stringify(fmt1015.hits.map((h) => h.slug))}`,
);

// 12. Newly synced behavioral knowledge + incremental sync-cache diff test
const payGuardDev = search("isPayTabEnabled payTabEnabled", 4, "dev");
assert.ok(
  payGuardDev.some((h) => h.slug === "doc-calc-vat-discount" || h.slug === "arch-ui-grid-report-standard"),
  `isPayTabEnabled dev search failed: ${JSON.stringify(payGuardDev.map((h) => h.slug))}`,
);
const dateBoxDev = search("DateBox onCommit", 4, "dev");
assert.ok(
  dateBoxDev.some((h) => h.slug === "arch-ui-grid-report-standard"),
  `DateBox onCommit dev search failed: ${JSON.stringify(dateBoxDev.map((h) => h.slug))}`,
);
const { saveBaselineSnapshot, computeIncrementalDiffs } = await import("./sync-cache.mjs");
const diffRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bcbrain-synccache-"));
try {
  const cacheFile = path.join(diffRoot, "baseline.json.gz");
  fs.writeFileSync(path.join(diffRoot, "a.ts"), "const x = 1;\nconst y = 2;\n", "utf8");
  fs.writeFileSync(path.join(diffRoot, "ws.ts"), "const z = 3;\n", "utf8");
  const snap = saveBaselineSnapshot(diffRoot, { "a.ts": { bytes: 26 }, "ws.ts": { bytes: 13 } }, cacheFile);
  assert.equal(snap.cachedFiles, 2);
  fs.writeFileSync(path.join(diffRoot, "a.ts"), "const x = 1;\nconst y = 99;\n", "utf8");
  fs.writeFileSync(path.join(diffRoot, "ws.ts"), "const z = 3;   \n", "utf8");
  const inc = computeIncrementalDiffs(
    diffRoot,
    [
      { file: "a.ts", status: "modified" },
      { file: "ws.ts", status: "modified" },
    ],
    { cacheFile },
  );
  assert.equal(inc.hasBaseline, true);
  assert.equal(inc.files.find((f: { file: string }) => f.file === "ws.ts")?.status, "whitespaceOnly");
  const aDiff = inc.files.find((f: { file: string }) => f.file === "a.ts");
  assert.equal(aDiff?.status, "modified");
  assert.ok(aDiff?.hunks.some((l: string) => l.includes("+const y = 99;")), "incremental diff captures exact line delta");
} finally {
  fs.rmSync(diffRoot, { recursive: true, force: true });
}

// 13. Fast O(1) lookupDirect (menu codes 1001–9070 + SQL tables) & stripSeeAlso
const m4013 = lookupDirect("4013", "user");
assert.equal(m4013.kind, "menu", "lookupDirect('4013') finds menu");
assert.equal(m4013.menus[0]?.code, "4013");
assert.ok(m4013.menus[0]?.docs.every((d: { audience: string }) => d.audience !== "dev"), "lookupDirect(user) never exposes dev docs");

const m1005 = lookupDirect("1005", "user");
assert.equal(m1005.menus[0]?.code, "1005", "lookupDirect('1005') finds ปรับปรุงภาษา");

const tDev = lookupDirect("ic_trans", "dev");
assert.equal(tDev.kind, "table", "lookupDirect('ic_trans', 'dev') finds SQL table");
assert.equal(tDev.tables[0]?.table, "ic_trans");
const tUser = lookupDirect("ic_trans", "user");
assert.equal(tUser.tables.length, 0, "lookupDirect('ic_trans', 'user') strictly hides dev SQL tables");

const stripped = stripSeeAlso("# หัวข้อ\n\nเนื้อหาหลัก\n\n---\n\n## ดูต่อที่เกี่ยวข้อง\n- [[index]]");
assert.ok(!stripped.includes("ดูต่อที่เกี่ยวข้อง") && stripped.includes("เนื้อหาหลัก"), "stripSeeAlso drops duplicated footer");

// 14. Pre-split excerptNote, TL;DR, ultra mode, batch_ask, bootstrap-pack & gzipped vault-pack
const saleNote = getNote("howto-sale-invoice")!;
const saleTldr = getNoteTldr(saleNote);
assert.ok(saleTldr.length > 40 && saleTldr.length <= 520, `getNoteTldr concise (${saleTldr.length})`);
const fastEx = excerptNote(saleNote, terms("ขายสินค้าติดลบ"), 900, true);
assert.ok(!fastEx.includes("## ดูต่อที่เกี่ยวข้อง") && fastEx.length <= 1200, "excerptNote strips footer cleanly");

const bootUser = getBootstrapPack("user");
assert.ok(bootUser.text.includes("**4013**") && !bootUser.text.includes("ic_trans_detail"), "bootstrap-pack(user) has hot menus & no dev SQL tables");
const bootDev = getBootstrapPack("dev");
assert.ok(bootDev.text.includes("`ic_trans`") && bootDev.text.includes("NUMERIC"), "bootstrap-pack(dev) has core SQL tables & rules");

const vpack = getVaultPackGzip();
assert.ok(vpack.gz[0] === 0x1f && vpack.gz[1] === 0x8b && vpack.noteCount >= 365 && vpack.etag.startsWith('"bcbrain-'), "getVaultPackGzip produces valid gzip & ETag");

const ultraRes = runFastRestQuery({ q: "เปิดบิลขายออกใบกำกับภาษีทำยังไง", audience: "user", mode: "ultra" });
assert.ok(ultraRes.ok && !ultraRes.abstained && ultraRes.answer.length < 1100, `ultra mode compact (${ultraRes.answer.length})`);

const batchAskRaw = dispatchJsonRpcRaw({
  jsonrpc: "2.0",
  id: 77,
  method: "tools/call",
  params: { name: "batch_ask", arguments: { questions: ["เช็คเด้งทำยังไง", "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด"], audience: "user", mode: "ultra" } },
});
assert.ok(batchAskRaw && batchAskRaw.includes("Q1:") && batchAskRaw.includes("Q2:") && batchAskRaw.includes("🛑 Abstain"), "batch_ask answers grounded Q1 and abstains Q2");

// 15. MCP v3.0.0: 15 tools, Ground-Truth Runtime Index, 5 new smart tools, Gap Telemetry, REST runners & OpenAPI 3.1.0
const rpcCall = (method: string, params?: Record<string, unknown>) => {
  const raw = dispatchJsonRpcRaw({ jsonrpc: "2.0", id: 901, method, params });
  assert.ok(raw, `JSON-RPC ${method} returned payload`);
  return JSON.parse(raw!) as { result?: { serverInfo?: { name: string; version: string }; tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean }; error?: unknown };
};
const callTool = (name: string, args: Record<string, unknown>) => {
  const r = rpcCall("tools/call", { name, arguments: args });
  assert.equal(r.error, undefined, `${name} JSON-RPC error: ${JSON.stringify(r.error)}`);
  return { text: r.result?.content?.[0]?.text ?? "", isError: Boolean(r.result?.isError) };
};

const initRes = rpcCall("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "selftest", version: "1" } });
assert.equal(initRes.result?.serverInfo?.version, "3.0.0", "MCP server version bumped to 3.0.0");
assert.equal(SERVER_INFO.version, "3.0.0");

const manifest = getManifest();
assert.equal(manifest.version, "3.0.0", "getManifest reports v3.0.0");
assert.equal(manifest.toolCount, 15, `getManifest reports 15 tools (got ${manifest.toolCount})`);
assert.equal(manifest.capabilities.hybridRrf, true);
assert.equal(manifest.capabilities.sectionBm25, true);
assert.equal(manifest.capabilities.structuredFacts, true);
assert.equal(manifest.capabilities.errorIndex, true);
assert.equal(manifest.capabilities.groundingVerifier, true);

const toolsList = rpcCall("tools/list").result?.tools ?? [];
assert.equal(toolsList.length, 15, `tools/list must expose exactly 15 tools (got ${toolsList.length})`);
for (const expectedTool of [
  "quick_answer",
  "batch_ask",
  "lookup_menu",
  "batch_read",
  "ask_brain",
  "search_brain",
  "traverse_brain",
  "read_note",
  "list_notes",
  "find_media",
  "lookup_error",
  "search_sections",
  "get_facts",
  "whats_new",
  "verify_reference",
]) {
  assert.ok(toolsList.some((t) => t.name === expectedTool), `tools/list includes ${expectedTool}`);
}

// 15a. lookup_error (hit + Thai trap abstain + strict user isolation)
const errHit = callTool("lookup_error", { query: "ล็อกหน่วยต้นทุนแล้ว", audience: "user", limit: 3 });
assert.ok(!errHit.isError && errHit.text.includes("ts-stock-bom-unit-locked") && !errHit.text.includes("audience: dev"), `lookup_error hit: ${errHit.text}`);
const errTrap = callTool("lookup_error", { query: "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", audience: "user" });
assert.ok(!errTrap.isError && errTrap.text.includes("🛑 Abstain"), "lookup_error strictly abstains on Thai trap");
const devOnlyErrMsg = "รายการนี้เลือกประเภทเป็นเงินเชื่อ / เครดิต ระบบปิดการรับ/จ่ายชำระเงิน";
const errIsoUser = callTool("lookup_error", { query: devOnlyErrMsg, audience: "user" });
assert.ok(!errIsoUser.text.includes("audience: dev"), "lookup_error(user) never leaks dev notes");
const errIsoDev = callTool("lookup_error", { query: devOnlyErrMsg, audience: "dev" });
assert.ok(!errIsoDev.text.includes("🛑 Abstain") && !errIsoDev.text.includes("audience: user"), "lookup_error(dev) hits dev validation note without user notes");

// 15b. search_sections (surgical precision + block-aware + structured facts + user isolation)
const secRes = callTool("search_sections", {
  query: "ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิตรวมเช็คคงค้าง ส่วนที่ 4",
  audience: "user",
  limit: 3,
  max_chars: 1000,
});
assert.ok(
  !secRes.isError &&
    secRes.text.includes("start-erp-options-9-tabs") &&
    secRes.text.includes("ส่วนที่ 4") &&
    secRes.text.includes("## Structured Facts"),
  `search_sections precision + facts failed: ${secRes.text.slice(0, 300)}`,
);
const secIso = callTool("search_sections", { query: "ic_trans_detail gl_journal SELECT", audience: "user", limit: 5 });
assert.ok(!secIso.text.includes("audience: dev") && !secIso.text.includes("verified_sources:"), "search_sections(user) zero dev leaks");

// 15c. get_facts (typed facts + kinds filter + 0 SQL/code in user mode)
const USER_SQL_RE = /\b(?:SELECT|FROM|WHERE|COALESCE|NUMERIC|trans_flag|last_status|ic_trans|gl_journal|ar_customer)\b|\.(?:go|tsx?|sql):\d+/i;
const factsSlug = callTool("get_facts", { slugs: ["start-erp-options-9-tabs", "tbl-ic-trans"], kinds: ["menu", "rule"], audience: "user", limit: 10 });
assert.ok(factsSlug.text.includes("[menu]") && factsSlug.text.includes("1004"), "get_facts returns typed [menu] fact for 1004");
assert.ok(!factsSlug.text.includes("tbl-ic-trans") && !USER_SQL_RE.test(factsSlug.text), "get_facts(user) strictly blocks dev slug and SQL jargon");
const factsQuery = callTool("get_facts", { query: "ตารางราคา 4 รุ่น", kinds: ["limit"], audience: "user", limit: 10 });
assert.ok(factsQuery.text.includes("[limit]") && !USER_SQL_RE.test(factsQuery.text), "get_facts(query, kinds=['limit']) returns user-safe limits");
const factsDev = callTool("get_facts", { slugs: ["doc-calc-vat-discount"], kinds: ["formula"], audience: "dev", limit: 10 });
assert.ok(factsDev.text.includes("[formula]"), "get_facts(dev) returns [formula] facts");

// 15d. whats_new (recency + audience isolation)
const wnUser = callTool("whats_new", { days: 30, audience: "user", limit: 10 });
assert.ok(!wnUser.isError && wnUser.text.includes("[whats_new") && !wnUser.text.includes("| dev)"), "whats_new(user) returns recent non-dev notes");
const wnDev = callTool("whats_new", { days: 30, audience: "dev", limit: 10 });
assert.ok(!wnDev.isError && wnDev.text.includes("[whats_new") && !wnDev.text.includes("| user)"), "whats_new(dev) returns recent non-user notes");

// 15e. Ground-Truth Runtime Index & verify_reference (menus, dev tables/columns, forbidden tables, strict user SQL refusal)
const gStats = getGroundingStats();
assert.ok(gStats.available && gStats.menuCount >= 700 && gStats.tableCount >= 500 && gStats.columnCount >= 8000, `grounding-index loaded: ${JSON.stringify(gStats)}`);

const verMenuUser = JSON.parse(callTool("verify_reference", { menus: ["4013", "1005", "4999"], audience: "user" }).text);
assert.equal(verMenuUser.tablesRestricted, true, "verify_reference(user) sets tablesRestricted=true");
assert.ok(verMenuUser.menus.valid.some((m: { code: string; label: string }) => m.code === "4013" && m.label.length > 2), "4013 valid with Thai label");
assert.ok(verMenuUser.menus.valid.some((m: { code: string }) => m.code === "1005"), "1005 valid");
assert.ok(verMenuUser.menus.unknownMenus.includes("4999"), "4999 flagged in unknownMenus");
assert.ok(verMenuUser.menus.invalid[0]?.suggestions?.length > 0, "invalid menu includes nearest menu suggestions");

const verSqlRefusedUser = JSON.parse(
  callTool("verify_reference", {
    menus: ["4013"],
    tables: ["ic_trans", "totally_fake_table"],
    columns: ["ic_trans.doc_no"],
    audience: "user",
  }).text,
);
assert.equal(verSqlRefusedUser.tablesRestricted, true, "user mode strictly restricts SQL verification");
assert.equal(verSqlRefusedUser.ok, false, "user mode refuses SQL table/column request");
assert.equal(verSqlRefusedUser.tables.valid.length, 0, "user mode leaks 0 valid SQL tables");
assert.equal(verSqlRefusedUser.tables.invalid.length, 0, "user mode leaks 0 invalid SQL tables");
assert.equal(verSqlRefusedUser.columns.valid.length, 0, "user mode leaks 0 valid SQL columns");
assert.equal(verSqlRefusedUser.columns.invalid.length, 0, "user mode leaks 0 invalid SQL columns");
assert.ok(!JSON.stringify(verSqlRefusedUser).includes("ic_trans"), "user verify_reference output never echoes or leaks requested SQL table names");

const verDev = JSON.parse(
  callTool("verify_reference", {
    menus: ["4013"],
    tables: ["ic_trans", "ic_trans_typo", "bc_user_list"],
    columns: ["ic_trans.doc_no", "ic_trans.doc_noo", "fake_tbl.col"],
    audience: "dev",
  }).text,
);
assert.equal(verDev.tablesRestricted, false, "dev mode permits SQL verification");
assert.ok(verDev.tables.valid.some((t: { table: string; columnCount: number }) => t.table === "ic_trans" && t.columnCount > 50), "dev validates ic_trans");
const typoTbl = verDev.tables.invalid.find((t: { table: string }) => t.table === "ic_trans_typo");
assert.ok(typoTbl && typoTbl.suggestions.includes("ic_trans"), `dev suggests ic_trans for ic_trans_typo: ${JSON.stringify(typoTbl)}`);
const forbTbl = verDev.tables.invalid.find((t: { table: string }) => t.table === "bc_user_list");
assert.ok(forbTbl && forbTbl.suggestions.length === 0, "forbidden security table bc_user_list is never valid and gives zero hints");
assert.ok(verDev.columns.valid.some((c: { ref: string }) => c.ref === "ic_trans.doc_no"), "dev validates ic_trans.doc_no");
const typoCol = verDev.columns.invalid.find((c: { ref: string }) => c.ref === "ic_trans.doc_noo");
assert.ok(typoCol && typoCol.suggestions.includes("ic_trans.doc_no"), `dev suggests ic_trans.doc_no for typo: ${JSON.stringify(typoCol)}`);
assert.equal(verifyReferences({ menus: ["4013"], tables: ["ic_trans"], columns: ["ic_trans.doc_no"], audience: "dev" }).ok, true, "verifyReferences ok=true when all valid");

// 15f. Gap Telemetry capture on abstain / zero-hit (and PII sanitization)
clearGaps();
callTool("quick_answer", { question: "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", audience: "user" });
callTool("ask_brain", { question: "วิธีปลูกทุเรียนภูเขาไฟ", audience: "user" });
callTool("lookup_error", { query: "ยานอวกาศลงจอดบนดวงจันทร์ไม่ได้", audience: "user" });
callTool("search_sections", { query: "zzzzUnmatchedSectionToken99999", audience: "user" });
const mockLeakEmail = ["person", "example.org"].join("@");
callTool("search_brain", { query: `zzzzZeroHitQuery99999 ${mockLeakEmail}`, audience: "user" });
const gapRep = getGapReport(50);
assert.ok(gapRep.totalRecorded >= 5, `gap-log captured all 5 abstain/zero-hit calls (got ${gapRep.totalRecorded})`);
assert.ok(gapRep.byReason.abstain >= 2 && gapRep.byReason.zero_hit >= 2, `gap-log tracks abstain & zero_hit: ${JSON.stringify(gapRep.byReason)}`);
assert.ok(!JSON.stringify(gapRep).includes(mockLeakEmail), "gap-log strictly sanitizes emails before storing");

// 15g. quick_answer mode='fast' + structured facts + REST runners
const fastModeRes = runFastRestQuery({ q: "เปิดบิลขายออกใบกำกับภาษีทำยังไง", audience: "user", mode: "fast" });
assert.ok(fastModeRes.ok && !fastModeRes.abstained && fastModeRes.answer.startsWith("[quick_answer:fast"), "quick_answer mode=fast works");
assert.ok(Array.isArray(fastModeRes.facts) && fastModeRes.facts.every((f) => !USER_SQL_RE.test(f)), "runFastRestQuery attaches user-safe structured facts");
assert.equal(runErrorRestQuery({ q: "ล็อกหน่วยต้นทุนแล้ว", audience: "user", limit: 3 }).hits[0]?.slug, "ts-stock-bom-unit-locked");
assert.equal(runSectionsRestQuery({ q: "ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิตรวมเช็คคงค้าง ส่วนที่ 4", audience: "user", limit: 3, maxChars: 900 }).sections[0]?.slug, "start-erp-options-9-tabs");
assert.ok(runFactsRestQuery({ slugs: ["start-erp-options-9-tabs"], audience: "user", limit: 10 }).count > 0);
assert.ok(runWhatsNewRestQuery({ days: 30, audience: "user", limit: 5 }).count > 0);
assert.equal(runVerifyRestQuery({ menus: ["4013"], audience: "user" }).ok, true);
assert.ok(runGapsRestQuery(10).ok && runGapsRestQuery(10).totalRecorded >= 5);

// 15h. OpenAPI 3.1.0 spec validation
const spec = getOpenApiSpec() as { openapi?: string; info?: { version?: string }; servers?: { url?: string }[]; paths?: Record<string, unknown> };
assert.equal(spec.openapi, "3.1.0", "OpenAPI version is 3.1.0");
assert.equal(spec.info?.version, "3.0.0", "OpenAPI info.version is 3.0.0");
assert.equal(spec.servers?.[0]?.url, "https://brain.bcsmethai.com", "OpenAPI server URL matches production");
for (const p of [
  "/api/fast",
  "/api/error",
  "/api/sections",
  "/api/facts",
  "/api/whats-new",
  "/api/verify",
  "/api/gaps",
  "/api/bootstrap-pack",
  "/api/vault-pack",
  "/healthz",
  "/mcp",
]) {
  assert.ok(spec.paths && p in spec.paths, `OpenAPI spec documents ${p}`);
}

console.log(`selftest ok (v${SERVER_INFO.version}, tools=${toolsList.length}, grounding=${gStats.menuCount}m/${gStats.tableCount}t/${gStats.columnCount}c, 1005=${JSON.stringify(lang1005.hits.slice(0, 3).map((h) => h.slug))}, 1015=${fmt1015.hits[0]?.slug}, pack=${(vpack.gz.length / 1024).toFixed(0)}KB gz)`);
