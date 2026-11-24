// node scripts/mcp-eval.mjs [url]  — protocol, audience isolation, latency and retrieval check against a running MCP endpoint
// default url: http://localhost:3952/mcp ; production: https://brain.bcsmethai.com/mcp
const URL_ = process.argv[2] ?? "http://localhost:3952/mcp";
const ms = [];
let id = 0;

async function rpc(method, params = {}) {
  const t0 = performance.now();
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  ms.push(performance.now() - t0);
  return body;
}
const call = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  return { text: r.result?.content?.[0]?.text ?? "", isError: !!r.result?.isError || !!r.error, raw: r };
};

const fails = [];
const check = (ok, msg) => ok || fails.push(msg);

// ---- protocol ----
const getRes = await fetch(URL_, { method: "GET", headers: { Accept: "text/event-stream" } });
check(getRes.status === 405, `GET /mcp stateless endpoint returns 405 immediately (got ${getRes.status})`);

const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "eval", version: "1" } });
check(init.result?.serverInfo?.name === "bcbrain", "initialize serverInfo");
check(String(init.result?.serverInfo?.version ?? "").startsWith("3."), `initialize serverInfo version 3.x (got ${init.result?.serverInfo?.version})`);
const instr = init.result?.instructions ?? "";
check(
  instr.includes("quick_answer") && instr.includes("playbook-dev") && instr.includes("playbook-call-center") && instr.includes("audience") && instr.includes("verify_reference"),
  "initialize instructions cover speed tools, v3 tools, and both modes",
);

const listedTools = (await rpc("tools/list")).result?.tools ?? [];
const EXPECTED_TOOLS = [
  "quick_answer",
  "batch_ask",
  "lookup_menu",
  "batch_read",
  "ask_brain",
  "search_brain",
  "find_media",
  "traverse_brain",
  "read_note",
  "list_notes",
  "lookup_error",
  "search_sections",
  "get_facts",
  "whats_new",
  "verify_reference",
];
check(listedTools.length === 15, `tools/list returns 15 tools (got ${listedTools.length})`);
for (const t of EXPECTED_TOOLS) {
  const tool = listedTools.find((x) => x.name === t);
  check(!!tool, `tools/list has ${t}`);
  if (t !== "read_note") check(!!tool?.inputSchema?.properties?.audience, `${t} exposes audience param`);
}
const travTool = listedTools.find((x) => x.name === "traverse_brain");
check(!!travTool?.inputSchema?.properties?.to_slug, "traverse_brain exposes to_slug param");

// JSON-RPC batch request support
const batchRes = await fetch(URL_, {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify([
    { jsonrpc: "2.0", id: 9001, method: "ping" },
    { jsonrpc: "2.0", id: 9002, method: "tools/call", params: { name: "lookup_menu", arguments: { query: "4013", audience: "user" } } },
  ]),
});
const batchJson = await batchRes.json();
check(Array.isArray(batchJson) && batchJson.length === 2 && batchJson[1]?.result?.content?.[0]?.text?.includes("4013"), "JSON-RPC batch array works");

for (const slug of ["index", "INDEX", "[[index]]", "index.md", "sales-overview", "playbook-dev"]) {
  const r = await call("read_note", { slug });
  check(r.text.startsWith("# ") && r.text.includes("audience: "), `read_note accepts ${slug} and includes audience`);
}
check((await call("read_note", { slug: "no-such-note" })).text.includes("not found"), "read_note missing → hint");

const userList = (await call("list_notes", { audience: "user" })).text.split("\n").filter(Boolean);
const devList = (await call("list_notes", { audience: "dev" })).text.split("\n").filter(Boolean);
check(userList.length > 0 && userList.every((row) => !row.includes("| dev |")), "list_notes audience=user excludes dev");
check(devList.length > 0 && devList.every((row) => !row.includes("| user |")), "list_notes audience=dev excludes user");
check((await call("list_notes", { folder: "schema", audience: "user" })).text === "No notes match.", "list_notes folder=schema audience=user returns empty");
check((await call("ask_brain", { question: "x" })).isError, "ask_brain rejects 1-char question");

// ---- isolation checks ----
for (const q of ["ic_trans gl_journal SELECT", "trans_flag schema API"]) {
  const hits = JSON.parse((await call("search_brain", { query: q, audience: "user", limit: 10 })).text || "[]");
  check(hits.every((h) => h.audience !== "dev"), `search_brain audience=user isolation for "${q}"`);
}
for (const q of ["เช็คเด้ง ออกใบกำกับภาษี ราคา", "เปิดบิลขาย ลูกหนี้"]) {
  const hits = JSON.parse((await call("search_brain", { query: q, audience: "dev", limit: 10 })).text || "[]");
  check(hits.every((h) => h.audience !== "user"), `search_brain audience=dev isolation for "${q}"`);
}
const askUser = (await call("ask_brain", { question: "ตาราง ic_trans", audience: "user" })).text;
check(!askUser.includes("| audience: dev |"), "ask_brain audience=user excludes dev notes");
check(!askUser.includes("verified_sources:"), "ask_brain audience=user never exposes internal source file paths");
const askDev = (await call("ask_brain", { question: "ออกใบกำกับภาษีขาย", audience: "dev" })).text;
check(!askDev.includes("| audience: user |"), "ask_brain audience=dev excludes user notes");
check(askDev.includes("Connected Graph Context"), "ask_brain includes Connected Graph Context");
check(askDev.includes("verified_sources:"), "ask_brain audience=dev includes verified_sources grounding");
for (const trap of ["สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", "วิธีปลูกทุเรียนภูเขาไฟ"]) {
  const askTrap = (await call("ask_brain", { question: trap, audience: "user" })).text;
  check(
    askTrap.includes("🛑 Abstain") || askTrap.includes("No matching notes"),
    `ask_brain strictly abstains on ungrounded query "${trap}" to prevent hallucination`,
  );
}

// ---- traverse_brain (multi-hop, shortest path & isolation) ----
const travMulti = await call("traverse_brain", { slug: "sql-ic-stock-balance", depth: 2, audience: "dev" });
check(!travMulti.isError && travMulti.text.includes("## Hop 1") && travMulti.text.includes("## Hop 2"), "traverse_brain returns multi-hop results");
check(!travMulti.text.includes("| user |"), "traverse_brain audience=dev excludes user notes");

const travPath = await call("traverse_brain", { slug: "sql-ic-stock-balance", to_slug: "tbl-ic-unit", audience: "dev" });
check(!travPath.isError && travPath.text.includes("Path (") && travPath.text.includes("tbl-ic-unit"), "traverse_brain finds shortest path to tbl-ic-unit");

const travIso = await call("traverse_brain", { slug: "sql-ic-stock-balance", depth: 2, audience: "user" });
check(travIso.text.includes("not found in audience=user"), "traverse_brain blocks dev slug when audience=user");

const travBridge = await call("traverse_brain", {
  slug: "howto-marketplace-shopee-lazada-tiktok",
  to_slug: "tbl-ar-contract-marketplace",
  audience: "all",
});
check(
  !travBridge.isError && travBridge.text.includes("bridges_zone") && travBridge.text.includes("tbl-ar-contract-marketplace"),
  "traverse_brain(all) bridges User screen -> Dev SQL table via bridges_zone synapse",
);
const travSharesMenu = await call("traverse_brain", {
  slug: "howto-stock-costing-recalc",
  depth: 1,
  relation: "shares_menu",
  audience: "user",
});
check(
  !travSharesMenu.isError && travSharesMenu.text.includes("ts-stock-cost-mismatch-rebuild"),
  "traverse_brain(user) follows shares_menu synapse on Menu 2050",
);

// ---- media connectors for external AI agents (find_media + ask_brain + search_brain + read_note) ----
const fm = JSON.parse((await call("find_media", { query: "สมองของกิจการ", kind: "all", audience: "user" })).text || "{}");
check(
  fm.playlistUrl === "https://www.youtube.com/playlist?list=PLO9P7tPZLXB0" &&
    Array.isArray(fm.items) &&
    fm.items.some((x) => x.kind === "youtube" && x.videoId === "_DattZyKqDA" && x.thumbnailUrl) &&
    fm.items.some((x) => x.kind === "image" && x.url.startsWith("https://bcaccount.com/")),
  "find_media returns YouTube video (_DattZyKqDA + PLO9P7tPZLXB0 + thumbnailUrl) and bcaccount.com screenshot",
);
const askQuote = (await call("ask_brain", { question: "ทำใบเสนอราคาขายยังไง", audience: "user" })).text;
check(
  askQuote.includes("## Media & Reference Links") &&
    askQuote.includes("https://www.youtube.com/watch?v=") &&
    askQuote.includes("https://bcaccount.com/"),
  "ask_brain(user) appends ready-to-share YouTube & bcaccount.com links even on sub-note queries",
);
check(!askQuote.includes("youtube_videos:"), "ask_brain omits redundant per-note youtube_videos line (token saving)");
const askCompact = (await call("ask_brain", { question: "ทำใบเสนอราคาขายยังไง", audience: "user", compact: true })).text;
check(
  askCompact.length > 100 && askCompact.length < askQuote.length && askCompact.includes("## Media & Reference Links"),
  `ask_brain(compact=true) reduces token payload (${askCompact.length} vs ${askQuote.length})`,
);

// ---- ultra-fast speed tools: quick_answer, lookup_menu, batch_read ----
const qaUser = (await call("quick_answer", { question: "เปิดบิลขายออกใบกำกับภาษีทำยังไง", audience: "user" })).text;
check(
  qaUser.startsWith("[quick_answer") && qaUser.length > 200 && qaUser.length < 3200 && !qaUser.includes("| audience: dev |") && !qaUser.includes("verified_sources:"),
  `quick_answer(user) returns ultra-compact isolated answer (${qaUser.length} chars)`,
);
const qaMedia = (await call("quick_answer", { question: "เปิดบิลขายออกใบกำกับภาษีทำยังไง", audience: "user", include_media: true })).text;
check(qaMedia.includes("media: ") && (qaMedia.includes("youtube.com") || qaMedia.includes("bcaccount.com")), "quick_answer(include_media=true) appends compact media line");
const qaTrap = (await call("quick_answer", { question: "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", audience: "user" })).text;
check(qaTrap.includes("🛑 Abstain"), "quick_answer strictly abstains on out-of-domain trap");

const lm4013 = (await call("lookup_menu", { query: "4013", audience: "user" })).text;
check(lm4013.includes("**4013**") && lm4013.includes("ขายสินค้า/บริการ"), "lookup_menu(4013) finds sales invoice menu");
const lm1005 = (await call("lookup_menu", { query: "1005", audience: "user" })).text;
check(lm1005.includes("**1005**"), "lookup_menu(1005) finds language dictionary menu");
const lmTableDev = (await call("lookup_menu", { query: "ic_trans", audience: "dev" })).text;
check(lmTableDev.includes("`ic_trans`") && lmTableDev.includes("tbl-ic-trans"), "lookup_menu(ic_trans, dev) finds schema slug");
const lmTableUser = (await call("lookup_menu", { query: "ic_trans", audience: "user" })).text;
check(!lmTableUser.includes("tbl-ic-trans"), "lookup_menu(ic_trans, user) strictly blocks dev SQL tables");

const brRes = (await call("batch_read", { slugs: ["howto-sale-invoice", "ts-stock-negative-control", "tbl-ic-trans"], audience: "user", max_chars_per_note: 1200 })).text;
check(
  brRes.includes("slug: howto-sale-invoice") && brRes.includes("slug: ts-stock-negative-control") && brRes.includes("outside audience=user"),
  "batch_read reads multiple notes in 1 call and strictly enforces audience isolation",
);

const qaUltra = (await call("quick_answer", { question: "ปิดงวดบัญชีไม่ได้ต้องทำยังไง", audience: "user", mode: "ultra" })).text;
check(
  qaUltra.startsWith("[quick_answer:ultra") && qaUltra.length > 80 && qaUltra.length < 1100,
  `quick_answer(mode=ultra) returns ultra-compact TL;DR (${qaUltra.length} chars)`,
);

const baRes = (await call("batch_ask", { questions: ["เช็คเด้งทำยังไง", "เปิดบิลขายเมนูอะไร", "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด"], audience: "user", mode: "ultra" })).text;
check(
  baRes.includes("## Q1:") && baRes.includes("## Q2:") && baRes.includes("## Q3:") && baRes.includes("🛑 Abstain"),
  "batch_ask answers multiple questions in 1 call and strictly abstains ungrounded items",
);

// ---- v3 Smart MCP tools: lookup_error, search_sections, get_facts, whats_new, verify_reference ----
const leHit = (await call("lookup_error", { query: "ล็อกหน่วยต้นทุนแล้ว", audience: "user", limit: 3 })).text;
check(
  leHit.includes("ts-stock-bom-unit-locked") && !leHit.includes("audience: dev"),
  "lookup_error(user) finds ts-stock-bom-unit-locked without dev leak",
);
const leTrap = (await call("lookup_error", { query: "สูตรทำแกงเขียวหวานไก่ใส่กะทิสด", audience: "user" })).text;
check(leTrap.includes("🛑 Abstain"), "lookup_error strictly abstains on Thai trap");

const ssHit = (await call("search_sections", { query: "ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิตรวมเช็คคงค้าง ส่วนที่ 4", audience: "user", limit: 3, max_chars: 1000 })).text;
check(
  ssHit.includes("start-erp-options-9-tabs") && ssHit.includes("ส่วนที่ 4") && ssHit.includes("## Structured Facts") && !ssHit.includes("audience: dev"),
  "search_sections(user) returns exact section excerpt + structured facts without dev leak",
);

const gfUser = (await call("get_facts", { slugs: ["start-erp-options-9-tabs", "tbl-ic-trans"], kinds: ["menu", "rule"], audience: "user", limit: 10 })).text;
check(
  gfUser.includes("[menu]") && gfUser.includes("1004") && !gfUser.includes("tbl-ic-trans") && !/\b(?:ic_trans|gl_journal|trans_flag)\b/.test(gfUser),
  "get_facts(user) returns typed facts and strictly strips dev slugs & SQL jargon",
);

const wnUser = (await call("whats_new", { days: 30, audience: "user", limit: 10 })).text;
check(wnUser.includes("[whats_new") && !wnUser.includes("| dev)"), "whats_new(user) returns recent updates without dev notes");

const vrUser = JSON.parse((await call("verify_reference", { menus: ["4013", "4999"], tables: ["ic_trans"], columns: ["ic_trans.doc_no"], audience: "user" })).text || "{}");
check(
  vrUser.tablesRestricted === true &&
    vrUser.ok === false &&
    vrUser.menus?.valid?.some((m) => m.code === "4013") &&
    vrUser.menus?.unknownMenus?.includes("4999") &&
    (vrUser.tables?.valid?.length ?? -1) === 0 &&
    (vrUser.tables?.invalid?.length ?? -1) === 0 &&
    (vrUser.columns?.valid?.length ?? -1) === 0,
  "verify_reference(user) validates menus and strictly refuses/omits SQL tables & columns",
);

const vrDev = JSON.parse((await call("verify_reference", { menus: ["4013"], tables: ["ic_trans", "ic_trans_typo"], columns: ["ic_trans.doc_no", "ic_trans.doc_noo"], audience: "dev" })).text || "{}");
check(
  vrDev.tablesRestricted === false &&
    vrDev.tables?.valid?.some((t) => t.table === "ic_trans") &&
    vrDev.tables?.invalid?.some((t) => t.table === "ic_trans_typo" && t.suggestions?.includes("ic_trans")) &&
    vrDev.columns?.valid?.some((c) => c.ref === "ic_trans.doc_no") &&
    vrDev.columns?.invalid?.some((c) => c.ref === "ic_trans.doc_noo" && c.suggestions?.includes("ic_trans.doc_no")),
  "verify_reference(dev) validates SQL tables & table.column with fuzzy suggestions",
);

// ---- Fast cacheable REST endpoints (/api/fast, /api/bootstrap-pack, /api/vault-pack, v3 /api/* + OpenAPI 3.1) ----
const origin = new URL(URL_).origin;
const fastRes = await fetch(`${origin}/api/fast?q=${encodeURIComponent("เช็คเด้งทำยังไง")}&audience=user&mode=ultra`);
const fastJson = await fastRes.json();
check(
  fastRes.status === 200 && fastJson.ok && !fastJson.abstained && (fastRes.headers.get("cache-control") ?? "").includes("s-maxage"),
  "/api/fast returns cacheable ultra-fast JSON answer",
);
const bootRes = await fetch(`${origin}/api/bootstrap-pack?audience=user`);
const bootText = await bootRes.text();
check(
  bootRes.status === 200 && bootText.includes("**4013**") && !bootText.includes("ic_trans_detail") && !!bootRes.headers.get("etag"),
  "/api/bootstrap-pack(user) returns ETag-cached context pack without dev leaks",
);
const packRes = await fetch(`${origin}/api/vault-pack`);
const packBuf = Buffer.from(await packRes.arrayBuffer());
const packEtag = packRes.headers.get("etag") ?? "";
check(
  packRes.status === 200 && packBuf[0] === 0x1f && packBuf[1] === 0x8b && packBuf.length > 200_000 && packEtag.startsWith('"bcbrain-'),
  `/api/vault-pack returns valid gzipped vault mirror (${(packBuf.length / 1024).toFixed(0)} KB)`,
);
const pack304 = await fetch(`${origin}/api/vault-pack`, { headers: { "If-None-Match": packEtag } });
check(pack304.status === 304, `/api/vault-pack supports ETag 304 Not Modified (got ${pack304.status})`);

// v3 REST API probes
const errApiRes = await fetch(`${origin}/api/error?q=${encodeURIComponent("ล็อกหน่วยต้นทุนแล้ว")}&audience=user&limit=3`);
const errApiJson = await errApiRes.json();
check(
  errApiRes.status === 200 && errApiJson.ok && errApiJson.hits?.[0]?.slug === "ts-stock-bom-unit-locked",
  "/api/error returns matched Thai error fix",
);

const secApiRes = await fetch(`${origin}/api/sections?q=${encodeURIComponent("ห้ามขายสินค้าต่ำกว่าทุน วงเงินเครดิตรวมเช็คคงค้าง ส่วนที่ 4")}&audience=user&limit=3&max_chars=1000`);
const secApiJson = await secApiRes.json();
check(
  secApiRes.status === 200 && secApiJson.ok && secApiJson.sections?.[0]?.slug === "start-erp-options-9-tabs",
  "/api/sections returns surgical section excerpt + facts",
);

const factsApiRes = await fetch(`${origin}/api/facts?slugs=start-erp-options-9-tabs&kinds=menu&audience=user&limit=10`);
const factsApiJson = await factsApiRes.json();
check(
  factsApiRes.status === 200 && factsApiJson.ok && factsApiJson.count > 0 && factsApiJson.facts.every((f) => f.kind === "menu"),
  "/api/facts returns typed structured facts",
);

const wnApiRes = await fetch(`${origin}/api/whats-new?days=30&audience=user&limit=5`);
const wnApiJson = await wnApiRes.json();
check(
  wnApiRes.status === 200 && wnApiJson.ok && wnApiJson.count > 0 && wnApiJson.items.every((i) => i.audience !== "dev"),
  "/api/whats-new returns recent non-dev notes",
);

const verApiGet = await fetch(`${origin}/api/verify?menus=4013&tables=ic_trans&audience=user`);
const verApiGetJson = await verApiGet.json();
check(
  verApiGet.status === 200 && verApiGetJson.tablesRestricted === true && verApiGetJson.tables?.valid?.length === 0,
  "GET /api/verify(user) strictly refuses SQL tables",
);

const verApiPost = await fetch(`${origin}/api/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ menus: ["4013"], tables: ["ic_trans"], columns: ["ic_trans.doc_no"], audience: "dev" }),
});
const verApiPostJson = await verApiPost.json();
check(
  verApiPost.status === 200 && verApiPostJson.ok === true && verApiPostJson.tablesRestricted === false && verApiPostJson.columns?.valid?.length === 1,
  "POST /api/verify(dev) verifies menus, tables, and columns",
);

const gapsApiRes = await fetch(`${origin}/api/gaps?limit=20`);
const gapsApiJson = await gapsApiRes.json();
check(
  gapsApiRes.status === 200 && gapsApiJson.ok === true && (gapsApiRes.headers.get("cache-control") ?? "").includes("no-store"),
  "/api/gaps returns sanitized gap telemetry with Cache-Control: no-store",
);

const openApiRes = await fetch(`${origin}/api/openapi.json`);
const openApiJson = await openApiRes.json();
check(
  openApiRes.status === 200 && openApiJson.openapi === "3.1.0" && openApiJson.paths?.["/api/verify"] && openApiJson.paths?.["/mcp"],
  "/api/openapi.json serves valid OpenAPI 3.1.0 spec",
);
const mediaHits = JSON.parse((await call("search_brain", { query: "วิดีโอสอนใช้งาน YouTube คลิปสอน", limit: 3, audience: "user" })).text || "[]");
check(
  Array.isArray(mediaHits[0]?.videos) && mediaHits[0].videos.length > 0 && Array.isArray(mediaHits[0]?.images) && mediaHits[0].images.length > 0,
  "search_brain attaches videos and images arrays on media-bearing notes",
);
const readMediaNote = (await call("read_note", { slug: "howto-sale-overview" })).text;
check(
  readMediaNote.includes("youtube_videos:") && readMediaNote.includes("images: ") && readMediaNote.includes("https://bcaccount.com/"),
  "read_note appends youtube_videos and images summary lines",
);

// ---- retrieval: [audience, query, ...acceptable canonical hub slugs]; hit = any expected slug in top 5 ----
const CASES = [
  ["all", "สารบัญ แผนที่สมอง BC", "index"],
  ["user", "คู่มือ AI Call Center ตอบลูกค้า", "playbook-call-center"],
  ["user", "คู่มือ AI ฝ่ายขาย ก่อนซื้อ", "playbook-sales"],
  ["user", "เริ่มต้นใช้งานวันแรก ตั้งค่าบริษัท", "start-first-day"],
  ["user", "ขายสินค้า ออกใบกำกับภาษีขาย", "howto-sale-overview"],
  ["user", "ลูกหนี้ วางบิล รับชำระหนี้", "howto-ar-overview"],
  ["user", "สั่งซื้อ รับสินค้า ใบกำกับภาษีซื้อ", "howto-buy-overview"],
  ["user", "เจ้าหนี้ จ่ายชำระหนี้", "howto-ap-overview"],
  ["user", "คลังสินค้า ตรวจนับสต็อก โอนคลัง", "howto-stock-overview"],
  ["user", "เงินสด ธนาคาร เช็ค เงินมัดจำ", "howto-cash-bank-overview"],
  ["user", "สมุดรายวัน ปิดงวดบัญชี งบทดลอง", "howto-gl-overview"],
  ["user", "ภาษีมูลค่าเพิ่ม ภาษีหัก ณ ที่จ่าย", "howto-tax-overview"],
  ["user", "สินทรัพย์ถาวร ค่าเสื่อมราคา", "howto-asset-overview"],
  ["user", "แก้ไข ยกเลิก ลบ เอกสาร", "howto-doc-edit-cancel-delete"],
  ["user", "แก้ปัญหา เข้าเมนูไม่ได้ ไม่มีสิทธิ์", "ts-common-no-permission", "ts-overview"],
  ["user", "ปิดงวดบัญชีแล้ว แก้เอกสารไม่ได้", "ts-common-period-closed", "ts-overview"],
  ["user", "คำถามที่พบบ่อย FAQ", "faq-overview"],
  ["user", "ดูรายงาน กรองข้อมูล เจาะลึก", "rpt-overview"],
  ["user", "ระบบในชุด BC POS AutoCare WMS TMS", "sys-overview", "sales-overview"],
  ["user", "ภาพรวมระบบบัญชีหลัก BC Ai Account", "sys-account-overview", "sys-overview"],
  ["user", "คำศัพท์บัญชี ภาษี สต็อก", "term-overview"],
  ["user", "จุดเด่นระบบ ข้อมูลการขาย ข้อจำกัด", "sales-overview"],
  ["user", "รหัสเมนูทั้งหมด สารบัญเมนู 4 หลัก", "menu-catalog-overview"],
  ["user", "รหัสเมนู 2050 คำนวณยอดสต็อกใหม่", "ts-stock-cost-mismatch-rebuild", "howto-stock-costing-recalc", "menu-cat-2-stock"],
  ["user", "เมนู 3040 รายงานค้างรับสินค้าตามใบสั่งซื้อ", "menu-cat-3-purchase", "rpt-buy-po"],
  ["user", "หาเมนูไม่เจอ เมนูบัญชีหายไปไหน", "ts-menu-missing-switchboard"],
  ["user", "คีย์ลัด Ctrl+S ปุ่มสูตรส่วนลด คลิกขวาตารางสินค้า", "howto-screen-shortcuts-workbench"],
  ["user", "ดึงบิลวางบิลไม่ขึ้น ดึงบิลรับชำระหนี้ไม่เจอ", "ts-arap-balance-recalc"],
  ["user", "วิดีโอสอนใช้งาน YouTube คลิปสอน EP.1 ถึง EP.8", "video-visual-tutorials"],
  ["user", "ตารางราคา 4 รุ่น Concurrent Users Starter ฟรี 0 บาท", "sales-pricing-packages"],
  ["user", "โครงการพาร์ตเนอร์สำนักงานบัญชี ใช้ฟรี 0 บาท แยก Server", "sales-accounting-partner"],
  ["user", "เบอร์โทร LINE @bcaccount เวลาทำการ ซัพพอร์ต บริการวางระบบ", "sales-support-implementation-contact"],
  ["dev", "คู่มือ AI นักพัฒนา เขียนโค้ดต่อยอด", "playbook-dev"],
  ["dev", "กฎเหล็ก SQL บัญชี NUMERIC last_status", "dev-rules-accounting-sql"],
  ["dev", "เริ่มต้นเชื่อมต่อระบบ API quickstart", "dev-integration-quickstart"],
  ["dev", "โครงสร้างตาราง Data Dictionary schema", "schema-overview"],
  ["dev", "คลังคำสั่ง SQL SELECT รายงาน", "sql-overview"],
  ["dev", "สเปก MCP Gateway 11 tools", "api-mcp-gateway", "api-overview"],
  ["dev", "REST API Process Actions menuKey", "api-overview"],
  ["dev", "รหัส trans_flag Document Flow ผังบัญชี Dr Cr", "doctypes-overview"],
  ["dev", "สถาปัตยกรรม Multi-Tenant Feature Switchboard Company Brain", "arch-overview"],
  ["user", "ข้อเลือกพิเศษ 9 ส่วน เมนู 1004 ตั้งค่าห้ามขายต่ำกว่าทุน", "start-erp-options-9-tabs", "start-company-options"],
  ["user", "ปรับราคาสินค้า เมนู 2014 ส่วนลดบาร์โค้ด 2012 ลำดับดึงราคาขาย", "howto-price-center-discount-formula"],
  ["user", "กระทบยอดขาย Shopee TikTok Shop Lazada เมนู 6024 ใบกำกับอย่างย่อ", "howto-marketplace-shopee-lazada-tiktok"],
  ["user", "คำนวณเงินเดือน ประกันสังคม 2569 ภ.ง.ด.1 ส่งงบ DBD สบช.3 เมนู 9029", "howto-payroll-sso-pnd1-dbd-efiling"],
  ["user", "คืนภาษีนักท่องเที่ยว ภ.พ.10 e-VRT ขั้นต่ำ 2000 บาท", "howto-tourist-vat-refund-evrt"],
  ["user", "พิมพ์บาร์โค้ด A4 เมนู 2020 ป้ายขนส่ง 6006 ประวัติการพิมพ์ต้นฉบับ", "howto-print-labels-barcode-audit"],
  ["user", "จอลูกค้าใบที่ 2 POS เครื่องพิมพ์ความร้อน พักบิล เตะลิ้นชัก", "howto-pos-hardware-display-promo"],
  ["user", "1005 ปรับปรุงภาษา Language Dictionary", "menu-catalog-overview", "menu-cat-1-setup", "howto-global-ui-bilingual-datalist-tools"],
  ["dev", "findSalePrice bcRound TransRefImport ReconcileSubledger", "doc-price-engine-ref-import-calc"],
  ["dev", "ObjectBox SyncEngine ThermalPrinterService TIS-620 Flutter POS", "arch-pos-flutter-objectbox-sync"],
  ["dev", "TwoStageBrainExecutor evidenceFusionEngine 5-Channel Company Brain", "arch-company-brain-fusion-pipeline"],
];

let top1 = 0,
  top5 = 0,
  askHit = 0;
const notFirst = [];
for (const [audience, q, ...want] of CASES) {
  const hits = JSON.parse((await call("search_brain", { query: q, limit: 5, audience })).text || "[]").map((h) => h.slug);
  if (want.includes(hits[0])) top1++;
  else notFirst.push(`[${audience}] "${q}" → ${hits[0]} (want ${want[0]})`);
  if (hits.some((s) => want.includes(s))) top5++;
  else fails.push(`miss [${audience}] "${q}" → got ${hits.slice(0, 3).join(", ") || "(none)"}`);
  const ask = (await call("ask_brain", { question: q, audience })).text;
  if (want.some((s) => ask.includes(`slug: ${s} `))) askHit++;
}

ms.sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))].toFixed(0);
console.log(`${URL_}\nretrieval: top1 ${top1}/${CASES.length}, top5 ${top5}/${CASES.length}, ask_brain ${askHit}/${CASES.length}`);
console.log(`latency ms: p50 ${pct(0.5)} p95 ${pct(0.95)} max ${pct(1)} over ${ms.length} calls`);
if (process.env.VERBOSE) console.log(`not first:\n- ${notFirst.join("\n- ")}`);
console.log(fails.length ? `FAIL ${fails.length}:\n- ${fails.join("\n- ")}` : "all checks ok");
process.exitCode = fails.length ? 1 : 0;
