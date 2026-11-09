// node scripts/mcp-eval.mjs [url]  — protocol, latency and retrieval check against a running MCP endpoint
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
check((init.result?.instructions ?? "").length > 50, "initialize instructions");
const tools = (await rpc("tools/list")).result?.tools?.map((t) => t.name) ?? [];
for (const t of ["ask_brain", "search_brain", "read_note", "list_notes"]) check(tools.includes(t), `tools/list has ${t}`);

for (const slug of ["sales-overview", "SALES-OVERVIEW", "[[sales-overview]]", "sales-overview.md"]) {
  const r = await call("read_note", { slug });
  check(r.text.startsWith("# "), `read_note accepts ${slug}`);
}
check((await call("read_note", { slug: "no-such-note" })).text.includes("not found"), "read_note missing → hint");
const faq = (await call("list_notes", { folder: "faq" })).text.split("\n").length;
check(faq > 50, `list_notes folder=faq (${faq})`);
check((await call("ask_brain", { question: "x" })).isError, "ask_brain rejects 1-char question");

// ---- retrieval: [query, ...acceptable slugs]; hit = any expected slug in top 5 ----
const CASES = [ // customer phrasing (call center + presale); acceptable slugs, hit = any in top 5
  ["ต้นทุนแฝงคำนวณยังไง", "howto-stock-hidden-cost", "faq-stock-hidden-cost-effect", "term-landed-cost"],
  ["ต้นทุนเฉลี่ยคิดอย่างไร", "faq-stock-cost-method", "term-cost-method"],
  ["ยกเลิกเอกสารแล้วบัญชีกลับยังไง", "howto-doc-edit-cancel-delete", "howto-sale-cancel-docs", "howto-ap-cancel-docs", "ts-common-cannot-cancel-doc"],
  ["ปิดงวดบัญชีสิ้นปี", "howto-gl-end-of-year", "term-accounting-period", "ts-gl-close-errors"],
  ["ภาษีหัก ณ ที่จ่าย ภ.ง.ด.3", "howto-tax-wht-report", "howto-tax-wht-entry", "faq-tax-wht-certificate"],
  ["สต็อกติดลบ", "faq-stock-negative-allowed", "ts-sale-stock-negative", "ts-stock-negative-not-allowed"],
  ["ออกใบกำกับภาษีขาย", "howto-sale-invoice", "term-tax-invoice"],
  ["เช็คเด้ง ทำยังไง", "howto-cheque-received-return-renew"],
  ["แปลงหน่วยนับ", "howto-stock-units", "term-unit"],
  ["ค่าเสื่อมราคาสินทรัพย์", "howto-asset-depreciation-view", "term-depreciation", "rpt-asset-reports"],
  ["เข้าเมนูไม่ได้ ไม่มีสิทธิ์", "ts-common-no-permission", "howto-user-screen-permission"],
  ["รูปแบบเลขที่เอกสาร", "howto-setup-doc-format", "term-doc-no"],
  ["เชื่อม AI ผ่าน MCP token", "howto-setup-mcp-token", "faq-general-ai-connect"],
  ["วงเงินเครดิตลูกค้าเกิน", "ts-sale-credit-over", "howto-sale-credit-limit"],
  ["เงินมัดจำกับเงินล่วงหน้าต่างกันอย่างไร", "faq-sale-deposit-vs-advance", "faq-buy-advance-vs-deposit"],
  ["งบทดลองไม่ลงตัว", "rpt-gl-trial-balance", "howto-gl-inquiry-trial-balance"],
  ["ตรวจนับสต็อก", "howto-stock-count", "faq-stock-count-change-stock", "term-stock-count-adjust"],
  ["โอนสินค้าระหว่างคลัง", "howto-stock-transfer"],
  ["ล็อกอินไม่ได้", "ts-common-cannot-login"],
  ["ระบบในชุด BC มีอะไรบ้าง", "sales-overview", "index"],
  ["POS ขายตอนเน็ตหลุด", "sys-pos-app-offline-sync", "faq-pos-app-need-internet"],
  ["ศูนย์บริการรถยนต์ รับรถถึงปิดบิล", "sys-autocare-job-flow", "sales-by-business-autocare"],
  ["คลังสินค้า หยิบ แพ็ค ส่ง", "howto-wms-pick-pack-ship", "sys-wms-overview"],
  ["คนขับยืนยันส่งของ ถ่ายรูป", "howto-tms-record-pod", "sys-tms-overview"],
  ["ออกใบกำกับภาษีอิเล็กทรอนิกส์", "sys-etax-overview"],
  ["ราคาเท่าไร", "sales-faq-before-buy", "faq-general-price-and-support"],
  ["มีอะไรที่ยังไม่พร้อมใช้", "sales-current-limits"],
  ["ร้านค้าปลีกใช้ได้ไหม", "sales-by-business-retail"],
];
let top1 = 0, top5 = 0, askHit = 0;
const notFirst = [];
for (const [q, ...want] of CASES) {
  const hits = JSON.parse((await call("search_brain", { query: q, limit: 5 })).text || "[]").map((h) => h.slug);
  if (want.includes(hits[0])) top1++;
  else notFirst.push(`"${q}" → ${hits[0]} (want ${want[0]})`);
  if (hits.some((s) => want.includes(s))) top5++;
  else fails.push(`miss "${q}" → got ${hits.slice(0, 3).join(", ") || "(none)"}`);
  const ask = (await call("ask_brain", { question: q })).text;
  if (want.some((s) => ask.includes(`slug: ${s} `))) askHit++;
}

ms.sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))].toFixed(0);
console.log(`${URL_}\nretrieval: top1 ${top1}/${CASES.length}, top5 ${top5}/${CASES.length}, ask_brain ${askHit}/${CASES.length}`);
console.log(`latency ms: p50 ${pct(0.5)} p95 ${pct(0.95)} max ${pct(1)} over ${ms.length} calls`);
if (process.env.VERBOSE) console.log(`not first:\n- ${notFirst.join("\n- ")}`);
console.log(fails.length ? `FAIL ${fails.length}:\n- ${fails.join("\n- ")}` : "all checks ok");
process.exitCode = fails.length ? 1 : 0;
