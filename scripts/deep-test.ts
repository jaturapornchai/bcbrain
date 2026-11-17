// node scripts/deep-test.ts — 6-dimension accuracy, isolation, graph/3D, fuzz & throughput suite
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

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

const { RELATION_TYPES } = await import("../lib/groups.ts");
const {
  collectRelatedMedia,
  excerpt,
  expandSynonyms,
  findMedia,
  getNote,
  graph,
  groupedVaultNotes,
  noteDescription,
  renderNote,
  search,
  terms,
  traverseGraph,
  vault,
} = await import("../lib/vault.ts");
const { emitMcpEvent, recentMcpEvents, sanitizeMcpArg, subscribeMcpEvents } = await import("../lib/mcp-events.ts");
type AudienceFilter = import("../lib/groups.ts").AudienceFilter;

const tStart = performance.now();

// ============================================================
// 1. Tokenizer, Abbreviation & Relation-Prefix Resolution
// ============================================================
const tokCases: [string, (got: string[]) => boolean, string][] = [
  ["ตัดสต็อกยังไง", (g) => g.length === 2 && g[0] === "ตัด" && g[1] === "สต็อก", "ตัดสต็อกยังไง -> [ตัด, สต็อก]"],
  ["ตัดสต๊อกยังไง", (g) => g.length === 2 && g[0] === "ตัด" && g[1] === "สต็อก", "ตัดสต๊อก normalization"],
  ["ล๊อกเอกสาร แพ็คเกจ พ.ศ. 2569 ค.ศ. 2026", (g) => g.includes("ล็อก") && g.includes("แพ็ก") && g.includes("เกจ") && g.includes("พศ") && g.includes("คศ"), "Thai spelling variants & eras"],
  ["ภ.ง.ด.3 ภ.ง.ด.53 ภ.พ.30", (g) => g.includes("ภงด3") && g.includes("ภงด53") && g.includes("ภพ30"), "Thai tax form normalization"],
  ["ที่พบบ่อย", (g) => !g.includes("ที่พบ") && g.includes("พบ"), "stopword ที่ must not glue onto พบ"],
  ["ระบบในร้าน", (g) => !g.includes("ระบบใน") && g.includes("ระบบ") && g.includes("ร้าน"), "stopword ใน must not glue onto ระบบ"],
  ["ขายสด", (g) => !g.includes("ขายสด") && g.includes("ขาย") && g.includes("สด"), "ขายสด splits cleanly"],
  ["ปิดงวดบัญชี", (g) => g.includes("ปิด") && g.includes("งวด") && g.includes("บัญชี"), "ปิดงวดบัญชี segments cleanly"],
  ["ยอดคงเหลือสินค้า", (g) => g.includes("ยอด") && g.includes("คง") && g.includes("เหลือ") && g.includes("สินค้า"), "ยอดคงเหลือสินค้า no bogus glue"],
  ["ใช้POS", (g) => g.includes("ใช้") && g.includes("pos"), "mixed Thai+ASCII splits ใช้POS"],
  ["ตารางap_supplier", (g) => g.includes("ap_supplier") && g.includes("ap") && g.includes("supplier"), "mixed Thai+SQL ident splits cleanly"],
  ["ic_trans_detail.wh_code", (g) => g.includes("ic_trans_detail") && g.includes("wh_code") && g.includes("wh"), "dotted SQL ident extracts both parts"],
  ["bc_mcp_tokens", (g) => g.includes("bc_mcp_tokens") && g.includes("mcp"), "SQL underscore identifier preserves parts"],
  ["เครมยาง", (g) => g.includes("เคลม") && g.includes("ยาง"), "Thai เครม normalizes to เคลม"],
  ["รหัสเมนู 7.15.4", (g) => g.includes("7.15.4") && !g.includes("15"), "dotted menu code stays intact without noisy digit split"],
  ["คีย์ลัด Ctrl + S และ Alt+N", (g) => g.includes("ctrl_s") && g.includes("alt_n"), "keyboard shortcut combinations normalize cleanly"],
];
for (const [input, pred, msg] of tokCases) {
  const got = terms(input);
  assert.ok(pred(got), `DIM1 fail (${msg}): got ${JSON.stringify(got)}`);
}

// Synonym alignment
assert.ok(expandSynonyms(terms("ซัพพลายเออร์")).includes("เจ้าหนี้"), "DIM1: ซัพพลายเออร์ -> เจ้าหนี้ via terms()");
assert.ok(expandSynonyms(["ซัพพลายเออร์"]).includes("เจ้าหนี้"), "DIM1: raw ซัพพลายเออร์ -> เจ้าหนี้");
assert.ok(expandSynonyms(terms("ภ.พ.30")).includes("vat"), "DIM1: ภ.พ.30 -> vat");
assert.ok(expandSynonyms(terms("งบทดลอง")).includes("งบดุล"), "DIM1: งบทดลอง -> งบดุล");
assert.ok(expandSynonyms(terms("เช็คเด้ง")).includes("cb_chq_list"), "DIM1: เช็คเด้ง -> cb_chq_list");
assert.ok(expandSynonyms(terms("สินทรัพย์")).includes("fa_asset"), "DIM1: สินทรัพย์ -> fa_asset");

// getNote edge syntax normalization (relation prefixes, labels, hashes, folders, extensions)
const inv = vault().get("tbl-ic-inventory");
assert.ok(inv, "tbl-ic-inventory exists");
for (const ref of [
  "tbl-ic-inventory",
  "[[tbl-ic-inventory]]",
  "[[uses_table::tbl-ic-inventory|ตารางสินค้า]]",
  "[[depends_on::schema/tbl-ic-inventory.md#columns]]",
  "schema/tbl-ic-inventory.md",
]) {
  assert.equal(getNote(ref)?.slug, "tbl-ic-inventory", `DIM1 getNote("${ref}")`);
}
console.log(`[DIM 1] Tokenizer, Synonyms & Link Parsing OK (${tokCases.length + 11} assertions)`);

// ============================================================
// 2. Deep Retrieval Accuracy Suite (78 cases across all/user/dev)
// ============================================================
const CASES: [AudienceFilter, string, ...string[]][] = [
  // Core 31 canonical cases (synced with scripts/mcp-eval.mjs)
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
  ["dev", "คู่มือ AI นักพัฒนา เขียนโค้ดต่อยอด", "playbook-dev"],
  ["dev", "กฎเหล็ก SQL บัญชี NUMERIC last_status", "dev-rules-accounting-sql"],
  ["dev", "เริ่มต้นเชื่อมต่อระบบ API quickstart", "dev-integration-quickstart"],
  ["dev", "โครงสร้างตาราง Data Dictionary schema", "schema-overview"],
  ["dev", "คลังคำสั่ง SQL SELECT รายงาน", "sql-overview"],
  ["dev", "สเปก MCP Gateway 11 tools", "api-mcp-gateway", "api-overview"],
  ["dev", "REST API Process Actions menuKey", "api-overview"],
  ["dev", "รหัส trans_flag Document Flow ผังบัญชี Dr Cr", "doctypes-overview"],
  ["dev", "สถาปัตยกรรม Multi-Tenant Feature Switchboard Company Brain", "arch-overview"],

  // Extended 47 module-specific queries across all 16 groups
  ["user", "ทำใบเสนอราคา เปิดบิลขาย", "howto-sale-quotation", "howto-sale-overview"],
  ["user", "รับคืนสินค้า ออกใบลดหนี้ขาย", "howto-sale-return-cn-dn"],
  ["user", "จองสินค้า ใบสั่งขาย Sale Order", "howto-sale-reserve-so"],
  ["user", "รับชำระหนี้ ตัดบิล FIFO ลูกหนี้", "howto-ar-receipt-fifo"],
  ["user", "ใบขอซื้อ PR ใบสั่งซื้อ PO", "howto-buy-pr-po"],
  ["user", "ตรวจนับสต็อก ปรับปรุงยอดสต็อก", "howto-stock-count", "term-stock-count-adjust"],
  ["user", "ประกอบสินค้า BOM", "howto-stock-bom-assembly", "ts-stock-bom-unit-locked"],
  ["user", "สินค้าหมดอายุ ล็อต FEFO", "howto-stock-lots-expiry-fefo"],
  ["user", "ซีเรียลนัมเบอร์ รับประกัน เคลม RMA", "howto-stock-serial-warranty-rma"],
  ["user", "โอนย้ายคลัง เบิกสินค้า", "howto-stock-issue-transfer-adjust"],
  ["user", "ต้นทุนแฝง Landed Cost", "howto-stock-hidden-cost", "term-landed-cost"],
  ["user", "กระทบยอดธนาคาร Reconcile statement", "howto-cash-bank-reconcile"],
  ["user", "เช็ครับ เช็คขึ้นเงิน เช็คเด้ง", "howto-cheque-received", "term-cheque-status"],
  ["user", "เช็คจ่าย ตีเช็คให้เจ้าหนี้", "howto-cheque-paid"],
  ["user", "ตรวจสลิป PromptPay QR โอนเงิน", "howto-cash-promptpay-slip-verify"],
  ["user", "ภาษีซื้อ ภาษีขาย ยื่น ภ.พ.30", "howto-tax-vat-input-output"],
  ["user", "หนังสือรับรองหัก ณ ที่จ่าย 50 ทวิ ภ.ง.ด.3 ภ.ง.ด.53", "term-wht-50tawi", "howto-tax-wht-and-rd-export"],
  ["user", "ส่งออกไฟล์ยื่นภาษี RD Prep ประกันสังคม เงินเดือน", "howto-tax-wht-and-rd-export"],
  ["user", "ออกใบกำกับภาษีอิเล็กทรอนิกส์ e-Tax OCR", "howto-etax-stamp-ocr", "sys-etax-invoice"],
  ["user", "ขายสินค้าติดลบ สต็อกไม่พอ", "faq-negative-stock", "ts-stock-negative-control"],
  ["user", "POS เน็ตหลุด ออฟไลน์ ซิงค์บิล", "faq-pos-offline", "ts-pos-offline-sync", "howto-pos-offline-sync"],
  ["user", "ปิดกะ POS แคชเชียร์", "howto-pos-cashier-shift"],
  ["user", "ศูนย์ซ่อมรถยนต์ อู่ซ่อมรถ AutoCare", "sys-autocare-garage", "howto-autocare-service-flow", "sales-by-business-autocare"],
  ["user", "เครมยาง AutoCare", "howto-autocare-tire-claim"],
  ["user", "คลังสินค้า Pick Pack Bin WMS", "howto-wms-pick-pack-bin", "sys-wms-warehouse"],
  ["user", "จัดส่งสินค้า รถขนส่ง TMS e-POD", "howto-tms-trip-epod", "sys-tms-transport"],
  ["user", "ธุรกิจอู่ซ่อมรถ คาร์แคร์ ใช้แพ็กเกจไหน", "sales-by-business-autocare"],
  ["user", "ขายปลีก มินิมาร์ท ใช้ฟีเจอร์อะไร", "sales-by-business-retail"],
  ["user", "จำกัดวงเงินเครดิตลูกค้า ขออนุมัติ", "ts-sale-credit-limit", "howto-sale-credit-approve"],
  ["user", "พิมพ์รายงาน CSV PDF ออกแบบรายงาน", "rpt-print-export", "rpt-designer-custom"],

  // Call Center 4-digit menu codes, legacy dotted codes, shortcuts & frontline troubleshooting
  ["user", "รหัสเมนูทั้งหมด สารบัญเมนู 4 หลัก", "menu-catalog-overview"],
  ["user", "เมนู 1003 กำหนดรายละเอียดบริษัท", "start-company-options", "menu-catalog-overview", "menu-cat-1-setup"],
  ["user", "รหัสเมนู 2050 คำนวณยอดสต็อกใหม่", "ts-stock-cost-mismatch-rebuild", "howto-stock-costing-recalc", "menu-cat-2-stock"],
  ["user", "เมนู 3040 รายงานค้างรับสินค้าตามใบสั่งซื้อ", "menu-cat-3-purchase", "rpt-buy-po"],
  ["user", "รหัสเมนู 4013 ขายสินค้า ออกใบกำกับ", "howto-sale-invoice", "menu-cat-4-sales", "menu-catalog-overview"],
  ["user", "เมนู 5017 AI อ่านใบกำกับภาษีซื้อ 3 ทาง", "howto-ap-payment", "menu-cat-5-ap", "menu-catalog-overview"],
  ["user", "รหัสเมนู 6023 รับชำระหนี้ ออกใบเสร็จ", "howto-ar-receipt-fifo", "ts-arap-balance-recalc", "menu-cat-6-ar"],
  ["user", "รหัสเมนู 7.15.4 บันทึกเช็คผ่าน", "menu-cat-7-cash-bank", "howto-cheque-received"],
  ["user", "เมนู 8005 สัญญาเช่าซื้อ ลีสซิ่งรถยนต์", "menu-cat-8-fixed-assets", "howto-asset-hire-purchase"],
  ["user", "เมนู 9026 ส่งออกไฟล์ RD Prep 50 ทวิ", "ts-etax-wht-bank-reconcile", "howto-tax-wht-and-rd-export", "menu-cat-9-gl"],
  ["user", "หาเมนูไม่เจอ เมนูบัญชีหายไปไหน", "ts-menu-missing-switchboard"],
  ["user", "คีย์ลัด Ctrl+S ปุ่มสูตรส่วนลด คลิกขวาตารางสินค้า", "howto-screen-shortcuts-workbench"],
  ["user", "หน้าจัดการระบบ เปลี่ยนรหัสผ่าน เพิ่มผู้ใช้ สร้างฐานข้อมูล", "howto-admin-system-management"],
  ["user", "พิมพ์ใบกำกับภาษีไม่ออก วันที่เป็น ค.ศ. อยากเปลี่ยนเป็น พ.ศ.", "ts-print-form-date-format"],
  ["user", "ดึงบิลวางบิลไม่ขึ้น ดึงบิลรับชำระหนี้ไม่เจอ", "ts-arap-balance-recalc"],

  // Website (www.bcaccount.com) pricing, partner, contact, tax calendar, AI chat & YouTube (PLO9P7tPZLXB0)
  ["user", "วิดีโอสอนใช้งาน YouTube คลิปสอน EP.1 ถึง EP.8", "video-visual-tutorials"],
  ["user", "ตารางราคา 4 รุ่น Concurrent Users Starter ฟรี 0 บาท", "sales-pricing-packages"],
  ["user", "โครงการพาร์ตเนอร์สำนักงานบัญชี ใช้ฟรี 0 บาท แยก Server", "sales-accounting-partner"],
  ["user", "เบอร์โทร LINE @bcaccount เวลาทำการ ซัพพอร์ต บริการวางระบบ", "sales-support-implementation-contact"],
  ["user", "ระบบแชทบอทร้านค้า BC Ai Chat BCAiChatOA คูปอง Rich Menu", "sys-bc-ai-chat-oa"],
  ["user", "ปฏิทินภาษี 2569 ซื้อซอฟต์แวร์หักรายจ่าย 2 เท่า ฉบับที่ 469", "howto-tax-calendar-and-sme-incentives"],
  ["user", "แผนผังเว็บ bcaccount.com รวมบทความบัญชีภาษี", "website-manual-and-blog-directory"],

  ["dev", "query ยอดคงเหลือสินค้า แยกตามคลังสินค้า", "sql-ic-stock-balance"],
  ["dev", "sql สต็อกการ์ด ต้นทุนย้อนหลัง lot", "sql-ic-stock-card-cost"],
  ["dev", "sql อายุหนี้ AR aging ค้างชำระ", "sql-ar-aging-analysis"],
  ["dev", "sql อายุหนี้เจ้าหนี้ AP aging", "sql-ap-aging-analysis"],
  ["dev", "sql งบทดลอง เปรียบเทียบยอดเดบิตเครดิต", "sql-gl-trial-balance"],
  ["dev", "sql ภาษีซื้อ ภาษีขาย ภ.พ.30", "sql-tax-vat-buy-sale-pp30"],
  ["dev", "sql ทะเบียนหัก ณ ที่จ่าย ภ.ง.ด.3 53", "sql-tax-wht-pnd-register"],
  ["dev", "sql กระทบยอดธนาคาร statement", "sql-cb-bank-reconcile"],
  ["dev", "ตาราง ic_trans_detail โครงสร้างคอลัมน์", "tbl-ic-trans-detail"],
  ["dev", "ตาราง ic_inventory สินค้า", "tbl-ic-inventory"],
  ["dev", "ตาราง gl_journal สมุดรายวัน", "tbl-gl-journal"],
  ["dev", "ตาราง gl_chart_of_account ผังบัญชี", "tbl-gl-chart-of-account"],
  ["dev", "ตาราง ar_customer ลูกค้า", "tbl-ar-customer"],
  ["dev", "ตาราง ap_supplier ผู้จำหน่าย", "tbl-ap-supplier"],
  ["dev", "Query Gateway ExecuteSQL API", "api-query-gateway"],
  ["dev", "Process Engine Action API workflow", "api-process-engine"],
  ["dev", "คำนวณ VAT ส่วนลด ฐานภาษี doctype", "doc-calc-vat-discount"],
  ["dev", "ลงบัญชีอัตโนมัติ ซื้อขาย AR AP templates", "doc-gl-templates-trade-apar", "doc-gl-posting-engine"],
  ["dev", "Multi-Tenant Dependency Injection Context", "arch-multi-tenant-di"],

  // Deep D:\bcaiaccount coverage: Menu 1004 9 tabs, Pricing, Marketplace, Payroll/DBD, Tourist VAT, Print Audit, POS ObjectBox, Company Brain Fusion
  ["user", "ข้อเลือกพิเศษ 9 ส่วน เมนู 1004 ห้ามขายต่ำกว่าทุน ห้ามติดลบ", "start-erp-options-9-tabs", "start-company-options"],
  ["user", "ปรับราคาสินค้า เมนู 2014 กำหนดส่วนลดตามบาร์โค้ด 2012 ลำดับดึงราคา", "howto-price-center-discount-formula"],
  ["user", "สินค้าทดแทน Ctrl+6 ทอนหน่วยใหญ่หน่วยย่อย หมายเหตุรายการ Ctrl+E", "howto-line-modals-pack-replacement"],
  ["user", "กระทบยอดขาย Shopee TikTok Shop Lazada เมนู 6024 ใบกำกับอย่างย่อ", "howto-marketplace-shopee-lazada-tiktok"],
  ["user", "คำนวณเงินเดือน ประกันสังคม 2569 เพดาน 875 ภ.ง.ด.1 ส่งงบ DBD สบช.3 เมนู 9029", "howto-payroll-sso-pnd1-dbd-efiling"],
  ["user", "กล่องรับสลิป LINE เมนู 7021 ตามบิล 50 ทวิ ขาด 9030 ออกบิลด่วน 6026", "howto-sme-collaboration-public-bill-pay"],
  ["user", "คืนภาษีนักท่องเที่ยว ภ.พ.10 e-VRT ขั้นต่ำ 2000 บาท", "howto-tourist-vat-refund-evrt"],
  ["user", "พิมพ์สติกเกอร์บาร์โค้ด A4 เมนู 2020 ป้ายชื่อขนส่ง 6006 ประวัติการพิมพ์ต้นฉบับสำเนา", "howto-print-labels-barcode-audit"],
  ["user", "กระทบยอดบัญชีย่อยเทียบแยกประเภท 5 หมวด ตรวจเอกสารสต็อก 29 รายการ", "howto-sysproc-reconcile-maintenance"],
  ["user", "สลับสองภาษา ไทย อังกฤษ ปรับแต่งคอลัมน์ตาราง แพ้ยา ปักหมุดแผนที่", "howto-global-ui-bilingual-datalist-tools"],
  ["user", "จอลูกค้าใบที่ 2 POS เครื่องพิมพ์ความร้อน 80 มม. พักบิล เตะลิ้นชัก", "howto-pos-hardware-display-promo"],
  ["dev", "ObjectBox 13 entities SyncEngine ThermalPrinterService TIS-620 POS", "arch-pos-flutter-objectbox-sync"],
  ["dev", "TwoStageBrainExecutor evidenceFusionEngine 5-Channel RRF Company Brain", "arch-company-brain-fusion-pipeline"],
  ["dev", "SQL erp_print_audit_log ar_marketplace_settlement erp_payroll_run cb_book_bank", "sql-marketplace-payroll-subledger-audit"],
];

// Pre-build search indexes once (without polluting CASES keys) to measure pure uncached query time
search("สินค้า", 1, "all");
search("สินค้า", 1, "user");
search("สินค้า", 1, "dev");

let top1 = 0;
let top5 = 0;
const misses: string[] = [];
const notTop1: string[] = [];
const u0 = performance.now();
for (const [aud, q, ...want] of CASES) {
  const hits = search(q, 5, aud).map((h) => h.slug);
  if (want.includes(hits[0])) top1++;
  else notTop1.push(`${aud} | "${q}" -> #1=${hits[0] ?? "NONE"} (want ${want.join("/")})`);
  if (want.some((w) => hits.includes(w))) top5++;
  else misses.push(`${aud} | "${q}" -> [${hits.join(", ")}] (want ${want.join("/")})`);
}
const uncachedTotalMs = performance.now() - u0;
const uncachedPerCallMs = uncachedTotalMs / CASES.length;
const top1Pct = ((top1 / CASES.length) * 100).toFixed(1);
const top5Pct = ((top5 / CASES.length) * 100).toFixed(1);
console.log(
  `[DIM 2] Deep Retrieval (${CASES.length} uncached queries, ${uncachedTotalMs.toFixed(2)} ms = ${uncachedPerCallMs.toFixed(4)} ms/search): Top1=${top1}/${CASES.length} (${top1Pct}%), Top5=${top5}/${CASES.length} (${top5Pct}%)`,
);
if (misses.length) console.log("  Top5 misses:\n  " + misses.join("\n  "));
if (notTop1.length && notTop1.length <= 15) console.log("  Top1 notes:\n  " + notTop1.join("\n  "));
assert.equal(top5, CASES.length, `DIM2 Top5 must be 100%: ${top5}/${CASES.length}`);
assert.ok(top1 / CASES.length >= 0.98, `DIM2 Top1 rate too low: ${top1}/${CASES.length}`);
assert.ok(uncachedPerCallMs < 0.5, `DIM2 uncached search too slow: ${uncachedPerCallMs.toFixed(4)} ms/search`);

// ============================================================
// 3. Exhaustive 313-Note Audience Isolation Audit
// ============================================================
const allNotes = [...vault().values()];
assert.ok(allNotes.length >= 300, "vault contains full note set");
let isoChecks = 0;
for (const n of allNotes) {
  if (n.audience === "dev") {
    const blocked = traverseGraph({ slug: n.slug, depth: 3, audience: "user", limit: 30 });
    assert.equal(blocked.start, null, `DIM3: dev note ${n.slug} must not start traverse(user)`);
    assert.equal(blocked.neighbors.length, 0, `DIM3: dev note ${n.slug} zero neighbors in user`);
    const devRes = traverseGraph({ slug: n.slug, depth: 2, audience: "dev", limit: 30 });
    assert.ok(devRes.neighbors.every((s) => s.audience !== "user"), `DIM3: dev traverse(${n.slug}) leaked user note`);
    isoChecks += 2;
  } else if (n.audience === "user") {
    const blocked = traverseGraph({ slug: n.slug, depth: 3, audience: "dev", limit: 30 });
    assert.equal(blocked.start, null, `DIM3: user note ${n.slug} must not start traverse(dev)`);
    assert.equal(blocked.neighbors.length, 0, `DIM3: user note ${n.slug} zero neighbors in dev`);
    const userRes = traverseGraph({ slug: n.slug, depth: 2, audience: "user", limit: 30 });
    assert.ok(userRes.neighbors.every((s) => s.audience !== "dev"), `DIM3: user traverse(${n.slug}) leaked dev note`);
    isoChecks += 2;
  } else {
    const u = traverseGraph({ slug: n.slug, depth: 2, audience: "user", limit: 30 });
    const d = traverseGraph({ slug: n.slug, depth: 2, audience: "dev", limit: 30 });
    assert.ok(u.neighbors.every((s) => s.audience !== "dev"), `DIM3: both traverse(user) leaked dev from ${n.slug}`);
    assert.ok(d.neighbors.every((s) => s.audience !== "user"), `DIM3: both traverse(dev) leaked user from ${n.slug}`);
    isoChecks += 2;
  }
}
for (const q of ["ic_trans_detail gl_journal SELECT NUMERIC", "trans_flag ExecuteSQL ar_customer", "Query Gateway MCP JWT"]) {
  assert.ok(search(q, 20, "user").every((h) => h.audience !== "dev"), `DIM3 search(user) leak for "${q}"`);
}
for (const q of ["ราคาเท่าไหร่ แพ็กเกจ จุดเด่น ขายปลีก", "เช็คเด้ง แก้ไขบิล ยกเลิก"]) {
  assert.ok(search(q, 20, "dev").every((h) => h.audience !== "user"), `DIM3 search(dev) leak for "${q}"`);
}
console.log(`[DIM 3] Exhaustive ${allNotes.length}-Note Isolation Audit OK (${isoChecks} traversal audits, 0 leaks)`);

// ============================================================
// 4. Graph Integrity, Precomputed 3D Coordinates & Full Render Safety
// ============================================================
for (const f of ["all", "user", "dev"] as AudienceFilter[]) {
  const g = graph(f);
  assert.equal(g.links.length, g.rels.length, `DIM4 graph(${f}) links/rels alignment`);
  const seenEdge = new Set<string>();
  for (let i = 0; i < g.links.length; i++) {
    const [u, v] = g.links[i];
    assert.ok(u >= 0 && u < g.nodes.length && v >= 0 && v < g.nodes.length && u !== v, `DIM4 edge bounds (${f})`);
    assert.ok(RELATION_TYPES.includes(g.rels[i]), `DIM4 valid rel (${f})`);
    const k = u < v ? `${u}-${v}` : `${v}-${u}`;
    assert.ok(!seenEdge.has(k), `DIM4 duplicate edge ${k} (${f})`);
    seenEdge.add(k);
  }
  for (const node of g.nodes) {
    assert.ok(Array.isArray(node.pos) && node.pos.length === 3, `DIM4 missing precomputed pos on ${node.slug}`);
    const [x, y, z] = node.pos!;
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `DIM4 finite pos on ${node.slug}`);
    const k = (x / 6.2) ** 2 + (y / 4.8) ** 2 + (z / 7.4) ** 2;
    assert.ok(k <= 0.785, `DIM4 ellipsoid bound exceeded on ${node.slug}: k=${k}`);
  }
}

let missingLinkNotes = 0;
for (const n of allNotes) {
  const html = renderNote(n);
  assert.ok(html.length > 0, `DIM4 renderNote empty for ${n.slug}`);
  assert.ok(!/<script\b|javascript:|onerror\s*=/i.test(html), `DIM4 unsafe HTML in ${n.slug}`);
  if (html.includes('href="#missing"')) missingLinkNotes++;
}
assert.equal(missingLinkNotes, 0, "DIM4 zero broken wikilinks across all notes");
const allYt = findMedia({ query: "*", kind: "youtube", audience: "user", limit: 40 });
const allImg = findMedia({ query: "*", kind: "image", audience: "user", limit: 40 });
assert.ok(allYt.items.length >= 15 && allYt.items.every((v) => v.url.startsWith("https://www.youtube.com/")), "DIM4 YouTube catalog populated & canonical");
assert.ok(allImg.items.length >= 25 && allImg.items.every((i) => i.url.startsWith("https://bcaccount.com/") || i.url.startsWith("https://qr-official.line.me/")), "DIM4 screenshot catalog populated & canonical");
assert.equal(collectRelatedMedia(["sql-ic-stock-balance"], "dev").videos.length, 0, "DIM4 dev notes stay clean without user marketing media");

for (const f of ["all", "user", "dev"] as AudienceFilter[]) {
  const grp = groupedVaultNotes(f);
  assert.ok(grp.length > 0, `DIM4 groupedVaultNotes(${f}) non-empty`);
  for (const [, list] of grp) {
    for (const n of list) {
      if (f === "user") assert.notEqual(n.audience, "dev", `DIM4 grouped(${f}) isolation`);
      if (f === "dev") assert.notEqual(n.audience, "user", `DIM4 grouped(${f}) isolation`);
    }
  }
}
const desc = noteDescription(inv!);
assert.ok(desc.length > 10 && desc.length <= 160 && !/[`*]/.test(desc), `DIM4 noteDescription clean: ${desc}`);

for (const asset of ["app/icon.png", "app/opengraph-image.png"]) {
  const buf = fs.readFileSync(asset);
  assert.ok(buf.byteLength > 1024, `DIM4 asset too small: ${asset}`);
  assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `DIM4 invalid PNG signature: ${asset}`);
}

console.log(`[DIM 4] Graph, Grouping, 3D Bounds & Render Safety OK (3 graphs + ${allNotes.length} HTML renders, 0 broken links)`);

// ============================================================
// 5. Fuzzing & Edge Cases
// ============================================================
for (const weird of ["", "   ", "?!@#$%^&*()", "คือ อะไร ยังไง ครับ ค่ะ", "' OR 1=1; DROP TABLE ic_trans;--", "x".repeat(2500), "🔥💡📊 สินค้า"]) {
  const r = search(weird, 5, "all");
  assert.ok(Array.isArray(r) && r.length <= 5, `DIM5 fuzz failed on len=${weird.length}`);
}
assert.equal(getNote("definitely-not-a-note-slug"), undefined);
assert.equal(traverseGraph({ slug: "definitely-not-a-note-slug", audience: "all" }).start, null);
assert.ok(excerpt("intro\n## Sec 1\nabc\n## Sec 2\ndef", ["sec"], 0).length > 0);
assert.ok(excerpt("short", ["short"], 1000) === "short");

const mockKey = ["sk", "dummy1234567890abcdef12"].join("-");
const mockMail = ["user", "example.com"].join("@");
const mockIp = ["203.0", "113.5"].join(".");
const mockTel = ["081", "2345678"].join("");
const sanitized = sanitizeMcpArg(`test ${mockKey} email ${mockMail} ip ${mockIp} tel ${mockTel}`);
assert.ok(!sanitized.includes(mockKey), "DIM5 sanitizeMcpArg redacts key");
assert.ok(!sanitized.includes(mockMail), "DIM5 sanitizeMcpArg redacts email");
assert.ok(!sanitized.includes(mockIp), "DIM5 sanitizeMcpArg redacts IP");
assert.ok(!sanitized.includes(mockTel), "DIM5 sanitizeMcpArg redacts phone");
assert.ok(sanitizeMcpArg("ก".repeat(140)).length <= 97, "DIM5 sanitizeMcpArg truncates >96 chars");

const receivedEvents: string[] = [];
const unsub = subscribeMcpEvents((ev) => receivedEvents.push(ev.tool));
for (let i = 0; i < 45; i++) {
  emitMcpEvent({
    tool: "search_brain",
    audience: "dev",
    rawArg: `query-${i}`,
    hits: [{ slug: "sql-ic-stock-balance", title: "ยอดคงเหลือสินค้า", folder: "queries" }],
    totalHits: 1,
    ms: 1.2,
  });
}
unsub();
assert.equal(receivedEvents.length, 45, "DIM5 subscribeMcpEvents receives live events");
assert.equal(recentMcpEvents(100).length, 40, "DIM5 recentMcpEvents caps buffer at 40");

console.log("[DIM 5] Fuzz, MCP Event Bus & Boundary Edge Cases OK");

// ============================================================
// 6. High-Resolution Throughput Benchmarks
// ============================================================
const benchQueries = CASES.map(([, q, ], i) => ({ q, aud: CASES[i][0] }));
for (const c of benchQueries) search(c.q, 8, c.aud);

const s0 = performance.now();
for (let i = 0; i < 1000; i++) {
  const c = benchQueries[i % benchQueries.length];
  search(c.q, 8, c.aud);
}
const searchTotalMs = performance.now() - s0;
const searchPerCallMs = searchTotalMs / 1000;

const g0 = performance.now();
for (let i = 0; i < 1000; i++) {
  graph("all");
}
const graphTotalMs = performance.now() - g0;
const graphPerCallMs = graphTotalMs / 1000;

const r0 = performance.now();
for (const n of allNotes) renderNote(n);
const renderWarmTotalMs = performance.now() - r0;
const renderWarmPerNoteMs = renderWarmTotalMs / allNotes.length;

const tr0 = performance.now();
for (let i = 0; i < 500; i++) {
  traverseGraph({ slug: i % 2 === 0 ? "sql-ic-stock-balance" : "howto-sale-overview", depth: 2, audience: i % 2 === 0 ? "dev" : "user", limit: 20 });
}
const travTotalMs = performance.now() - tr0;
const travPerCallMs = travTotalMs / 500;

console.log(
  `[DIM 6] Throughput (${allNotes.length} notes):\n` +
    `  search() warm 1000 calls:       ${searchTotalMs.toFixed(2)} ms total (${searchPerCallMs.toFixed(4)} ms/search)\n` +
    `  graph("all") warm 1000 calls:   ${graphTotalMs.toFixed(2)} ms total (${graphPerCallMs.toFixed(4)} ms/call)\n` +
    `  renderNote() warm ${allNotes.length} notes:   ${renderWarmTotalMs.toFixed(2)} ms total (${renderWarmPerNoteMs.toFixed(4)} ms/note)\n` +
    `  traverseGraph() 500 calls:      ${travTotalMs.toFixed(2)} ms total (${travPerCallMs.toFixed(4)} ms/call)\n` +
    `  suite total elapsed:            ${(performance.now() - tStart).toFixed(1)} ms`,
);

assert.ok(searchPerCallMs < 0.05, `DIM6 warm search too slow: ${searchPerCallMs.toFixed(4)} ms/search`);
assert.ok(graphPerCallMs < 0.05, `DIM6 graph() too slow: ${graphPerCallMs.toFixed(4)} ms/call`);
assert.ok(renderWarmPerNoteMs < 0.05, `DIM6 renderNote() too slow: ${renderWarmPerNoteMs.toFixed(4)} ms/note`);
console.log("deep-test ok");
