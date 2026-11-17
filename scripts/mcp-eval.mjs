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
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "eval", version: "1" } });
check(init.result?.serverInfo?.name === "bcbrain", "initialize serverInfo");
const instr = init.result?.instructions ?? "";
check(instr.includes("playbook-dev") && instr.includes("playbook-call-center") && instr.includes("audience"), "initialize instructions cover both modes");

const listedTools = (await rpc("tools/list")).result?.tools ?? [];
for (const t of ["ask_brain", "search_brain", "find_media", "traverse_brain", "read_note", "list_notes"]) {
  const tool = listedTools.find((x) => x.name === t);
  check(!!tool, `tools/list has ${t}`);
  if (t !== "read_note") check(!!tool?.inputSchema?.properties?.audience, `${t} exposes audience param`);
}
const travTool = listedTools.find((x) => x.name === "traverse_brain");
check(!!travTool?.inputSchema?.properties?.to_slug, "traverse_brain exposes to_slug param");

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
const askDev = (await call("ask_brain", { question: "ออกใบกำกับภาษีขาย", audience: "dev" })).text;
check(!askDev.includes("| audience: user |"), "ask_brain audience=dev excludes user notes");
check(askDev.includes("Connected Graph Context"), "ask_brain includes Connected Graph Context");

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
