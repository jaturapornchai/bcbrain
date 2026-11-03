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

for (const slug of ["proc-hidden-cost", "PROC-HIDDEN-COST", "[[proc-hidden-cost]]", "proc-hidden-cost.md"]) {
  const r = await call("read_note", { slug });
  check(r.text.startsWith("# "), `read_note accepts ${slug}`);
}
check((await call("read_note", { slug: "no-such-note" })).text.includes("not found"), "read_note missing → hint");
const faq = (await call("list_notes", { folder: "faq" })).text.split("\n").length;
check(faq > 50, `list_notes folder=faq (${faq})`);
check((await call("ask_brain", { question: "x" })).isError, "ask_brain rejects 1-char question");

// ---- retrieval: [query, ...acceptable slugs]; hit = any expected slug in top 5 ----
const CASES = [
  ["ต้นทุนแฝงคำนวณยังไง", "proc-hidden-cost", "faq-hidden-cost-landed", "scr-hidden-cost"],
  ["ต้นทุนเฉลี่ยเคลื่อนที่คิดอย่างไร", "acc-inventory-cost-moving-average", "faq-moving-average-cost"],
  ["ยกเลิกเอกสารแล้วกลับรายการบัญชียังไง", "flow-cancel-edit-reversal", "faq-cancel-vs-edit-vs-delete", "proc-doc-cancel-approve"],
  ["ปิดงวดบัญชีสิ้นปี", "faq-year-end-close", "flow-period-year-close", "acc-period-close"],
  ["ภาษีหัก ณ ที่จ่าย ภ.ง.ด.3", "faq-wht-certificate-pnd", "acc-vat-register-wht", "term-wht"],
  ["สต็อกติดลบ", "faq-negative-stock"],
  ["บันทึกพร้อมกันแล้ว deadlock", "faq-concurrent-save-deadlock", "hist-lessons-concurrency-advisory-locks"],
  ["ตั้งชื่อคอลัมน์ตาราง postgres", "std-pgsql-naming-convention"],
  ["ใบกำกับภาษีขายลงบัญชียังไง", "faq-sale-invoice-gl-posting", "doc-sale-invoice"],
  ["เช็ครับ ผ่านเช็ค เช็คคืน", "doc-cheque-received-lifecycle", "faq-cheque-received-lifecycle"],
  ["แปลงหน่วยนับขนาน", "faq-unit-conversion", "term-unit-ratio", "std-parallel-unit-and-ref-import"],
  ["ค่าเสื่อมราคาสินทรัพย์", "acc-fixed-asset-depreciation", "faq-fixed-asset-depreciation"],
  ["ปีพุทธศักราชในวันที่เอกสาร", "faq-buddhist-year-date", "term-buddhist-year", "hist-lessons-dates-buddhist-year"],
  ["เข้าเมนูไม่ได้ ไม่มีสิทธิ์", "faq-menu-permission-denied", "proc-permission-rights"],
  ["รูปแบบเลขที่เอกสาร", "faq-doc-number-format", "tbl-erp-doc-format", "proc-doc-flow-numbering"],
  ["เชื่อม MCP ใช้ token", "faq-mcp-server", "api-mcp", "scr-mcp-token"],
  ["วงเงินเครดิตลูกค้าเกิน", "acc-credit-limit-save-rules", "faq-credit-limit-approval"],
  ["เงินมัดจำกับเงินล่วงหน้าต่างกันอย่างไร", "faq-deposit-vs-advance", "acc-deposit-advance", "term-deposit-advance"],
  ["ปัดเศษทศนิยม", "acc-rounding-decimal", "faq-rounding-decimal", "hist-lessons-rounding-decimal"],
  ["how is moving average cost calculated", "acc-inventory-cost-moving-average", "faq-moving-average-cost"],
  ["landed cost allocation", "proc-hidden-cost", "faq-hidden-cost-landed"],
  ["how to cancel a document and reverse journal entries", "flow-cancel-edit-reversal", "proc-doc-cancel-approve", "faq-cancel-vs-edit-vs-delete"],
  ["query gateway read only", "api-query-gateway", "be-query-gateway", "adr-0005-query-gateway-read-only-first", "faq-query-gateway"],
  ["why is the trial balance not balanced", "faq-gl-not-balanced", "faq-balance-mismatch-troubleshoot"],
  ["year end closing", "faq-year-end-close", "flow-period-year-close"],
  ["withholding tax certificate", "faq-wht-certificate-pnd", "acc-vat-register-wht"],
  ["multi currency exchange rate", "acc-fx-multi-currency", "faq-fx-multi-currency", "term-currency-fx"],
  ["procure to pay steps", "faq-procure-to-pay-steps", "flow-procure-to-pay"],
  ["how to add a new report", "faq-add-new-report"],
  ["session expired logout", "faq-session-logout-expired"],
  ["negative stock", "faq-negative-stock"],
  ["stock count adjustment", "faq-stock-count-adjust", "doc-stock-count"],
  ["ic_trans_detail", "tbl-ic-trans-detail"],
  ["trans_flag 44", "acc-trans-flag-map", "term-trans-flag", "faq-where-trans-flag-handled"],
  ["/api/v1/process/master/datalistget", "api-proc-actions-master"],
  ["hidden_cost.go", "proc-hidden-cost"],
  ["gl_journal_detail", "tbl-gl-journal-detail"],
  ["HiddenCostScreen", "scr-hidden-cost"],
  ["SystemProcessWorkbenchScreen", "scr-system-process-workbench"],
  ["erp_user_datalist_config", "tbl-erp-user-datalist-config"],
  ["query exec write blocked", "faq-query-exec-write-blocked", "adr-0011-query-exec-write-lockdown"],
  ["ADR session revocation", "adr-0004-session-revocation-store"],
  ["bc_mcp_access_tokens", "tbl-bc-mcp-tokens"],
  ["bc_mcp_tokens", "tbl-bc-mcp-tokens", "api-mcp", "scr-mcp-token"],
  ["item_master.go", "proc-item-master-detail", "scr-item-master", "api-proc-actions-master"],
  ["BcDataList.tsx", "scr-data-list-and-lookup", "fe-grid-component"],
  ["token.go", "tbl-bc-mcp-tokens", "api-mcp"],
  ["ar_customer columns", "tbl-ar-customer"],
  ["permission.go RequiredRight", "proc-permission-rights", "be-menu-rights-permission"],
  ["ระบบในชุด BC มีอะไรบ้าง", "systems-overview"],
  ["POS ขายตอนเน็ตหลุด ออฟไลน์", "sys-pos-offline-storage", "sys-pos-sync-client", "sys-pos-overview"],
  ["ศูนย์บริการรถยนต์ รับรถถึงปิดบิล", "sys-autocare-job-flow", "sys-autocare-overview"],
  ["ใบกำกับภาษีอิเล็กทรอนิกส์ e-Tax", "sys-etax-overview", "sys-etax-document-stamp"],
  ["คลังสินค้า หยิบ แพ็ค ส่ง", "sys-wms-fulfillment-pick-pack-ship", "sys-wms-overview"],
  ["ขนส่ง ยืนยันส่งของ POD", "sys-tms-trip-pod-flow", "sys-tms-overview"],
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
